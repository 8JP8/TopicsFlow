from datetime import datetime, timedelta
import random
import string
from models.user import User
from utils.validators import validate_phone
from utils.content_filter import contains_profanity


class RecoveryService:
    """Service for account recovery using SMS and security questions."""

    def __init__(self, db):
        self.db = db
        self.user_model = User(db)
        self.reset_tokens = {}  # In production, use Redis or database

    def initiate_recovery(self, username: str, method: str = 'sms') -> dict:
        """Initiate account recovery process."""
        if not username:
            return {'success': False, 'errors': ['Username is required']}

        user = self.user_model.get_user_by_username(username.strip())
        if not user:
            return {'success': False, 'errors': ['User not found']}

        if method == 'sms':
            return self._initiate_sms_recovery(user)
        elif method == 'security_questions':
            return self._initiate_security_questions_recovery(user)
        else:
            return {'success': False, 'errors': ['Invalid recovery method']}

    def _initiate_sms_recovery(self, user: dict) -> dict:
        """Initiate SMS-based recovery."""
        if not user.get('phone'):
            return {'success': False, 'errors': ['No phone number on file']}

        if not validate_phone(user['phone']):
            return {'success': False, 'errors': ['Invalid phone number on file']}

        # Generate verification code
        verification_code = ''.join(random.choices(string.digits, k=6))
        reset_token = secrets.token_urlsafe(32)

        # Store in memory (in production, use Redis with expiry)
        self.reset_tokens[reset_token] = {
            'user_id': str(user['_id']),
            'username': user['username'],
            'verification_code': verification_code,
            'method': 'sms',
            'expires_at': datetime.utcnow() + timedelta(minutes=10)
        }

        # Send SMS (placeholder - implement with actual SMS service)
        sms_sent = self._send_verification_sms(user['phone'], verification_code)

        if sms_sent:
            return {
                'success': True,
                'message': 'Verification code sent to your phone',
                'reset_token': reset_token,
                'expires_in': 600  # 10 minutes
            }
        else:
            return {'success': False, 'errors': ['Failed to send verification code']}

    def _initiate_security_questions_recovery(self, user: dict) -> dict:
        """Initiate security questions-based recovery."""
        security_questions = user.get('security_questions', [])
        if len(security_questions) < 2:
            return {'success': False, 'errors': ['Not enough security questions set up']}

        # Return questions without answers for user to answer
        questions = []
        for i, question in enumerate(security_questions):
            questions.append({
                'id': i,
                'question': question['question']
            })

        reset_token = secrets.token_urlsafe(32)
        self.reset_tokens[reset_token] = {
            'user_id': str(user['_id']),
            'username': user['username'],
            'method': 'security_questions',
            'expires_at': datetime.utcnow() + timedelta(minutes=15)
        }

        return {
            'success': True,
            'questions': questions,
            'reset_token': reset_token,
            'expires_in': 900  # 15 minutes
        }

    def verify_recovery_sms(self, reset_token: str, verification_code: str) -> dict:
        """Verify SMS code for account recovery."""
        if not reset_token or not verification_code:
            return {'success': False, 'errors': ['Reset token and verification code are required']}

        token_data = self.reset_tokens.get(reset_token)
        if not token_data:
            return {'success': False, 'errors': ['Invalid or expired reset token']}

        # Check expiry
        if datetime.utcnow() > token_data['expires_at']:
            del self.reset_tokens[reset_token]
            return {'success': False, 'errors': ['Reset token has expired']}

        # Verify code
        if token_data.get('verification_code') != verification_code:
            return {'success': False, 'errors': ['Invalid verification code']}

        # Generate new TOTP secret and QR data
        new_totp_secret = self.user_model.reset_totp(token_data['user_id'])
        qr_data = self.user_model.get_totp_qr_data(token_data['user_id'])
        backup_codes = self.user_model.generate_backup_codes(token_data['user_id'])

        # Clean up token
        del self.reset_tokens[reset_token]

        return {
            'success': True,
            'message': 'Identity verified. Please set up your authenticator app again.',
            'totp_qr_data': qr_data,
            'backup_codes': backup_codes
        }

    def verify_security_questions(self, reset_token: str, answers: list) -> dict:
        """Verify security question answers for account recovery."""
        if not reset_token or not answers or len(answers) < 2:
            return {'success': False, 'errors': ['Reset token and at least 2 answers are required']}

        token_data = self.reset_tokens.get(reset_token)
        if not token_data:
            return {'success': False, 'errors': ['Invalid or expired reset token']}

        # Check expiry
        if datetime.utcnow() > token_data['expires_at']:
            del self.reset_tokens[reset_token]
            return {'success': False, 'errors': ['Reset token has expired']}

        # Verify answers
        if self.user_model.verify_security_questions(token_data['username'], answers):
            # Generate new TOTP secret and QR data
            new_totp_secret = self.user_model.reset_totp(token_data['user_id'])
            qr_data = self.user_model.get_totp_qr_data(token_data['user_id'])
            backup_codes = self.user_model.generate_backup_codes(token_data['user_id'])

            # Clean up token
            del self.reset_tokens[reset_token]

            return {
                'success': True,
                'message': 'Identity verified. Please set up your authenticator app again.',
                'totp_qr_data': qr_data,
                'backup_codes': backup_codes
            }
        else:
            return {'success': False, 'errors': ['Incorrect answers to security questions']}

    def confirm_totp_reset(self, user_id: str, totp_code: str) -> dict:
        """Confirm new TOTP setup after recovery."""
        if not user_id or not totp_code:
            return {'success': False, 'errors': ['User ID and TOTP code are required']}

        if not self.user_model.verify_totp(user_id, totp_code):
            return {'success': False, 'errors': ['Invalid TOTP code']}

        # Enable TOTP
        if self.user_model.enable_totp(user_id):
            return {
                'success': True,
                'message': 'Account recovery completed successfully. You can now login with your new authenticator.'
            }
        else:
            return {'success': False, 'errors': ['Failed to complete account recovery']}

    def _send_verification_sms(self, phone_number: str, code: str) -> bool:
        """Send verification code via SMS (placeholder implementation)."""
        # In production, integrate with SMS service like Twilio
        # For now, we'll just log the code
        print(f"SMS verification code for {phone_number}: {code}")
        return True

    def cleanup_expired_tokens(self):
        """Clean up expired reset tokens."""
        expired_tokens = []
        for token, data in self.reset_tokens.items():
            if datetime.utcnow() > data['expires_at']:
                expired_tokens.append(token)

        for token in expired_tokens:
            del self.reset_tokens[token]

    def get_recovery_status(self, reset_token: str) -> dict:
        """Get status of recovery process."""
        token_data = self.reset_tokens.get(reset_token)
        if not token_data:
            return {'success': False, 'error': 'Invalid reset token'}

        return {
            'success': True,
            'method': token_data['method'],
            'expires_at': token_data['expires_at'].isoformat(),
            'expires_in_seconds': int((token_data['expires_at'] - datetime.utcnow()).total_seconds())
        }

    def cancel_recovery(self, reset_token: str) -> dict:
        """Cancel ongoing recovery process."""
        if reset_token in self.reset_tokens:
            del self.reset_tokens[reset_token]
            return {'success': True, 'message': 'Recovery process cancelled'}
        else:
            return {'success': False, 'errors': ['Invalid reset token']}