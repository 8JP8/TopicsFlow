from flask import session
from datetime import datetime, timedelta
import pyotp
import secrets
import random
import string
import base64
from models.user import User
from services.email_service import EmailService
from services.passkey_service import PasskeyService
from utils.validators import validate_username, validate_email
from utils.content_filter import contains_profanity


class AuthService:
    """Service for handling authentication and TOTP operations."""

    def __init__(self, db):
        self.db = db
        self.user_model = User(db)
        self.email_service = EmailService()
        self.passkey_service = PasskeyService()

    def register_user(self, username: str, email: str, password: str,
                     phone: str = None, security_questions: list = None) -> dict:
        """Register a new user with TOTP setup."""
        # Validate inputs
        validation_errors = []

        if not username or len(username.strip()) < 3:
            validation_errors.append("Username must be at least 3 characters")
        elif not validate_username(username):
            validation_errors.append("Username contains invalid characters")
        elif contains_profanity(username):
            validation_errors.append("Username contains inappropriate content")

        if not email or not validate_email(email):
            validation_errors.append("Valid email is required")

        if not password or len(password) < 8:
            validation_errors.append("Password must be at least 8 characters")

        if validation_errors:
            return {'success': False, 'errors': validation_errors}

        try:
            # Create user with TOTP secret
            user_id = self.user_model.create_user(
                username=username.strip(),
                email=email.lower().strip(),
                password=password,
                phone=phone.strip() if phone else None,
                security_questions=security_questions or []
            )

            # Generate TOTP QR code data
            qr_data = self.user_model.get_totp_qr_data(user_id)

            return {
                'success': True,
                'user_id': user_id,
                'totp_qr_data': qr_data,
                'backup_codes': self.user_model.generate_backup_codes(user_id)
            }

        except ValueError as e:
            return {'success': False, 'errors': [str(e)]}
        except Exception as e:
            return {'success': False, 'errors': ['Registration failed. Please try again.']}

    def verify_totp_setup(self, user_id: str, totp_code: str) -> dict:
        """Verify TOTP setup and enable 2FA for user."""
        if not totp_code or len(totp_code) != 6:
            return {'success': False, 'errors': ['Invalid verification code']}

        if not self.user_model.verify_totp(user_id, totp_code):
            return {'success': False, 'errors': ['Invalid verification code']}

        # Enable TOTP for user
        if self.user_model.enable_totp(user_id):
            return {'success': True, 'message': '2FA enabled successfully'}
        else:
            return {'success': False, 'errors': ['Failed to enable 2FA']}

    def login_user(self, username: str, password: str, totp_code: str, ip_address: str = None) -> dict:
        """Authenticate user with username, password, and TOTP code."""
        validation_errors = []

        if not username or not password:
            validation_errors.append("Username and password are required")

        if not totp_code or len(totp_code) != 6:
            validation_errors.append("Authentication code is required")

        if validation_errors:
            return {'success': False, 'errors': validation_errors}

        try:
            # Verify credentials
            user = self.user_model.verify_credentials(username.strip(), password)
            if not user:
                return {'success': False, 'errors': ['Invalid username or password']}

            # Check if user is banned
            if self.user_model.is_user_banned(str(user['_id'])):
                return {'success': False, 'errors': ['Account is banned']}

            # Check if TOTP is enabled
            if not user.get('totp_enabled', False):
                return {'success': False, 'errors': ['2FA not set up. Please complete registration.']}

            # Verify TOTP code
            if not self.user_model.verify_totp(str(user['_id']), totp_code):
                return {'success': False, 'errors': ['Invalid authentication code']}

            # Record IP address
            if ip_address:
                self.user_model.add_ip_address(str(user['_id']), ip_address)

            # Create session
            session['user_id'] = str(user['_id'])
            session['username'] = user['username']
            session['authenticated'] = True
            session['login_time'] = datetime.utcnow().isoformat()

            return {
                'success': True,
                'user': {
                    'id': str(user['_id']),
                    'username': user['username'],
                    'email': user['email'],
                    'preferences': user.get('preferences', {}),
                    'totp_enabled': user.get('totp_enabled', False)
                }
            }

        except Exception as e:
            return {'success': False, 'errors': ['Login failed. Please try again.']}

    def login_with_backup_code(self, username: str, password: str, backup_code: str, ip_address: str = None) -> dict:
        """Authenticate user using backup code."""
        validation_errors = []

        if not username or not password:
            validation_errors.append("Username and password are required")

        if not backup_code or len(backup_code) != 8:
            validation_errors.append("Backup code must be 8 digits")

        if validation_errors:
            return {'success': False, 'errors': validation_errors}

        try:
            # Verify credentials
            user = self.user_model.verify_credentials(username.strip(), password)
            if not user:
                return {'success': False, 'errors': ['Invalid username or password']}

            # Check if user is banned
            if self.user_model.is_user_banned(str(user['_id'])):
                return {'success': False, 'errors': ['Account is banned']}

            # Verify backup code
            if not self.user_model.verify_backup_code(str(user['_id']), backup_code):
                return {'success': False, 'errors': ['Invalid backup code']}

            # Record IP address
            if ip_address:
                self.user_model.add_ip_address(str(user['_id']), ip_address)

            # Create session
            session['user_id'] = str(user['_id'])
            session['username'] = user['username']
            session['authenticated'] = True
            session['login_time'] = datetime.utcnow().isoformat()

            return {
                'success': True,
                'user': {
                    'id': str(user['_id']),
                    'username': user['username'],
                    'email': user['email'],
                    'preferences': user.get('preferences', {}),
                    'totp_enabled': user.get('totp_enabled', False)
                },
                'warning': 'Backup code used. Consider regenerating backup codes.'
            }

        except Exception as e:
            return {'success': False, 'errors': ['Login failed. Please try again.']}

    def logout_user(self) -> dict:
        """Logout user and clear session."""
        session.clear()
        return {'success': True, 'message': 'Logged out successfully'}

    def get_current_user(self) -> dict:
        """Get currently authenticated user from session."""
        if not session.get('authenticated'):
            return {'success': False, 'error': 'Not authenticated'}

        user_id = session.get('user_id')
        if not user_id:
            return {'success': False, 'error': 'No user in session'}

        try:
            user = self.user_model.get_user_by_id(user_id)
            if not user:
                session.clear()
                return {'success': False, 'error': 'User not found'}

            # Check if user is banned
            if self.user_model.is_user_banned(user_id):
                session.clear()
                return {'success': False, 'error': 'Account is banned'}

            return {
                'success': True,
                'user': {
                    'id': str(user['_id']),
                    'username': user['username'],
                    'email': user['email'],
                    'phone': user.get('phone'),
                    'preferences': user.get('preferences', {}),
                    'totp_enabled': user.get('totp_enabled', False),
                    'created_at': user['created_at'],
                    'last_login': user.get('last_login')
                }
            }

        except Exception as e:
            session.clear()
            return {'success': False, 'error': 'Session error'}

    def regenerate_backup_codes(self, user_id: str) -> dict:
        """Regenerate backup codes for user."""
        try:
            # Verify user exists and has TOTP enabled
            user = self.user_model.get_user_by_id(user_id)
            if not user:
                return {'success': False, 'errors': ['User not found']}

            if not user.get('totp_enabled', False):
                return {'success': False, 'errors': ['2FA not enabled']}

            backup_codes = self.user_model.generate_backup_codes(user_id)
            return {'success': True, 'backup_codes': backup_codes}

        except Exception as e:
            return {'success': False, 'errors': ['Failed to generate backup codes']}

    def change_password(self, user_id: str, current_password: str, new_password: str) -> dict:
        """Change user password."""
        validation_errors = []

        if not current_password or not new_password:
            validation_errors.append("Current and new passwords are required")

        if len(new_password) < 8:
            validation_errors.append("New password must be at least 8 characters")

        if validation_errors:
            return {'success': False, 'errors': validation_errors}

        try:
            # Verify current password by getting user and checking
            user = self.user_model.get_user_by_id(user_id)
            if not user:
                return {'success': False, 'errors': ['User not found']}

            # Check current password
            from werkzeug.security import check_password_hash
            if not check_password_hash(user['password_hash'], current_password):
                return {'success': False, 'errors': ['Current password is incorrect']}

            # Change password
            if self.user_model.change_password(user_id, new_password):
                return {'success': True, 'message': 'Password changed successfully'}
            else:
                return {'success': False, 'errors': ['Failed to change password']}

        except Exception as e:
            return {'success': False, 'errors': ['Password change failed']}

    def update_preferences(self, user_id: str, preferences: dict) -> dict:
        """Update user preferences."""
        try:
            # Validate preferences
            valid_themes = ['dark', 'light']
            valid_languages = ['en', 'pt']

            if 'theme' in preferences and preferences['theme'] not in valid_themes:
                return {'success': False, 'errors': ['Invalid theme']}

            if 'language' in preferences and preferences['language'] not in valid_languages:
                return {'success': False, 'errors': ['Invalid language']}

            if self.user_model.update_user_preferences(user_id, preferences):
                return {'success': True, 'message': 'Preferences updated'}
            else:
                return {'success': False, 'errors': ['Failed to update preferences']}

        except Exception as e:
            return {'success': False, 'errors': ['Failed to update preferences']}

    def is_authenticated(self) -> bool:
        """Check if current session is authenticated."""
        return session.get('authenticated', False) and session.get('user_id')

    def require_auth(self, f):
        """Decorator to require authentication for routes."""
        from functools import wraps
        from flask import jsonify

        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not self.is_authenticated():
                return jsonify({'success': False, 'error': 'Authentication required'}), 401
            return f(*args, **kwargs)
        return decorated_function

    def get_session_info(self) -> dict:
        """Get current session information."""
        return {
            'authenticated': session.get('authenticated', False),
            'user_id': session.get('user_id'),
            'username': session.get('username'),
            'login_time': session.get('login_time')
        }

    # Passwordless Authentication Methods
    def register_user_passwordless(self, username: str, email: str) -> dict:
        """Register a new user without password (passwordless auth)."""
        validation_errors = []

        if not username or len(username.strip()) < 3:
            validation_errors.append("Username must be at least 3 characters")
        elif not validate_username(username):
            validation_errors.append("Username contains invalid characters")
        elif contains_profanity(username):
            validation_errors.append("Username contains inappropriate content")

        if not email or not validate_email(email):
            validation_errors.append("Valid email is required")

        if validation_errors:
            return {'success': False, 'errors': validation_errors}

        try:
            # Create user without password
            user_id = self.user_model.create_user(
                username=username.strip(),
                email=email.lower().strip(),
                password=None  # No password for passwordless auth
            )

            # Generate and send email verification code
            verification_code = ''.join(random.choices(string.digits, k=6))
            self.user_model.set_email_verification_code(user_id, verification_code)

            # Send verification email
            email_result = self.email_service.send_verification_email(
                email.lower().strip(),
                username.strip(),
                verification_code
            )

            if not email_result.get('success'):
                return {'success': False, 'errors': ['Failed to send verification email']}

            return {
                'success': True,
                'user_id': user_id,
                'message': 'Verification code sent to your email'
            }

        except ValueError as e:
            return {'success': False, 'errors': [str(e)]}
        except Exception as e:
            return {'success': False, 'errors': ['Registration failed. Please try again.']}

    def verify_email(self, user_id: str, code: str) -> dict:
        """Verify email with code."""
        if not code or len(code) != 6:
            return {'success': False, 'errors': ['Invalid verification code']}

        if not self.user_model.verify_email_code(user_id, code):
            return {'success': False, 'errors': ['Invalid or expired verification code']}

        # Get TOTP QR code data for 2FA setup
        qr_data = self.user_model.get_totp_qr_data(user_id)
        totp_secret = self.user_model.get_totp_secret(user_id)

        return {
            'success': True,
            'message': 'Email verified successfully',
            'totp_qr_data': qr_data,
            'totp_secret': totp_secret,  # For manual entry
            'user_id': user_id
        }

    def resend_verification_code(self, user_id: str) -> dict:
        """Resend email verification code."""
        try:
            user = self.user_model.get_user_by_id(user_id)
            if not user:
                return {'success': False, 'errors': ['User not found']}

            if user.get('email_verified'):
                return {'success': False, 'errors': ['Email already verified']}

            # Generate new verification code
            verification_code = ''.join(random.choices(string.digits, k=6))
            self.user_model.set_email_verification_code(user_id, verification_code)

            # Send verification email
            email_result = self.email_service.send_verification_email(
                user['email'],
                user['username'],
                verification_code
            )

            if not email_result.get('success'):
                return {'success': False, 'errors': ['Failed to send verification email']}

            return {
                'success': True,
                'message': 'Verification code resent successfully'
            }

        except Exception as e:
            return {'success': False, 'errors': ['Failed to resend verification code']}

    def complete_totp_setup(self, user_id: str, totp_code: str) -> dict:
        """Complete TOTP setup and enable 2FA."""
        if not totp_code or len(totp_code) != 6:
            return {'success': False, 'error': 'Invalid verification code'}

        # Check if email is verified
        if not self.user_model.is_email_verified(user_id):
            return {'success': False, 'error': 'Email must be verified first'}

        # Verify TOTP code during setup (use verify_totp_setup which doesn't require totp_enabled=True)
        if not self.user_model.verify_totp_setup(user_id, totp_code):
            return {'success': False, 'error': 'Invalid authentication code'}

        # Enable TOTP
        if not self.user_model.enable_totp(user_id):
            return {'success': False, 'error': 'Failed to enable 2FA'}

        # Generate backup codes
        backup_codes = self.user_model.generate_backup_codes(user_id)

        # Store hash of original TOTP secret for recovery
        totp_secret = self.user_model.get_totp_secret(user_id)
        self.user_model.store_original_totp_secret(user_id, totp_secret)

        return {
            'success': True,
            'message': '2FA enabled successfully',
            'backup_codes': backup_codes
        }

    def login_passwordless(self, identifier: str, totp_code: str, ip_address: str = None) -> dict:
        """Login with username/email and TOTP code only (no password)."""
        validation_errors = []

        if not identifier:
            validation_errors.append("Username or email is required")

        if not totp_code or len(totp_code) != 6:
            validation_errors.append("Authentication code is required")

        if validation_errors:
            return {'success': False, 'errors': validation_errors}

        try:
            # Verify with TOTP only
            user = self.user_model.verify_totp_only(identifier.strip(), totp_code)
            if not user:
                return {'success': False, 'errors': ['Invalid credentials or authentication code']}

            # Check if user is banned
            if self.user_model.is_user_banned(str(user['_id'])):
                return {'success': False, 'errors': ['Account is banned']}

            # Check if email is verified
            if not user.get('email_verified', False):
                return {'success': False, 'errors': ['Email not verified. Please complete registration.']}

            # Record IP address
            if ip_address:
                self.user_model.add_ip_address(str(user['_id']), ip_address)

            # Create session
            session['user_id'] = str(user['_id'])
            session['username'] = user['username']
            session['authenticated'] = True
            session['login_time'] = datetime.utcnow().isoformat()

            return {
                'success': True,
                'user': {
                    'id': str(user['_id']),
                    'username': user['username'],
                    'email': user['email'],
                    'preferences': user.get('preferences', {}),
                    'totp_enabled': user.get('totp_enabled', False)
                }
            }

        except Exception as e:
            return {'success': False, 'errors': ['Login failed. Please try again.']}

    # Account Recovery Methods
    def initiate_recovery_passwordless(self, email: str) -> dict:
        """Initiate account recovery by sending recovery code to email."""
        if not email or not validate_email(email):
            return {'success': False, 'errors': ['Valid email is required']}

        try:
            user = self.user_model.get_user_by_email(email.lower().strip())
            if not user:
                # Don't reveal if email exists for security
                return {'success': True, 'message': 'If this email exists, a recovery code has been sent'}

            # Generate recovery code
            recovery_code = ''.join(random.choices(string.digits, k=6))
            self.user_model.set_recovery_code(email.lower().strip(), recovery_code)

            # Send recovery email
            email_result = self.email_service.send_recovery_email(
                email.lower().strip(),
                user['username'],
                recovery_code
            )

            return {
                'success': True,
                'message': 'If this email exists, a recovery code has been sent'
            }

        except Exception as e:
            return {'success': False, 'errors': ['Failed to initiate recovery']}

    def verify_recovery_code(self, email: str, code: str) -> dict:
        """Verify recovery code."""
        if not code or len(code) != 6:
            return {'success': False, 'errors': ['Invalid recovery code']}

        user_id = self.user_model.verify_recovery_code(email.lower().strip(), code)
        if not user_id:
            return {'success': False, 'errors': ['Invalid or expired recovery code']}

        return {
            'success': True,
            'message': 'Recovery code verified',
            'user_id': user_id
        }

    def reset_totp_with_original_secret(self, user_id: str, original_secret: str) -> dict:
        """Reset TOTP using original secret from initial setup."""
        if not original_secret:
            return {'success': False, 'errors': ['Original secret is required']}

        # Verify original secret
        if not self.user_model.verify_original_totp_secret(user_id, original_secret):
            return {'success': False, 'errors': ['Invalid original secret']}

        try:
            # Reset TOTP with new secret
            new_secret = self.user_model.reset_totp_with_new_secret(user_id)

            # Get user info
            user = self.user_model.get_user_by_id(user_id)
            if not user:
                return {'success': False, 'errors': ['User not found']}

            # Get QR code data
            qr_data = self.user_model.get_totp_qr_data(user_id)

            # Send notification email
            self.email_service.send_2fa_reset_notification(user['email'], user['username'])

            return {
                'success': True,
                'message': '2FA reset successfully',
                'totp_qr_data': qr_data,
                'totp_secret': new_secret,
                'user_id': user_id
            }

        except Exception as e:
            return {'success': False, 'errors': ['Failed to reset 2FA']}

    def complete_recovery_totp_setup(self, user_id: str, totp_code: str, new_secret: str) -> dict:
        """Complete TOTP setup after recovery."""
        if not totp_code or len(totp_code) != 6:
            return {'success': False, 'errors': ['Invalid verification code']}

        # Verify TOTP code
        if not self.user_model.verify_totp(user_id, totp_code):
            return {'success': False, 'errors': ['Invalid authentication code']}

        # Enable TOTP
        if not self.user_model.enable_totp(user_id):
            return {'success': False, 'errors': ['Failed to enable 2FA']}

        # Generate new backup codes
        backup_codes = self.user_model.generate_backup_codes(user_id)

        # Store new original secret for future recovery
        self.user_model.store_original_totp_secret(user_id, new_secret)

        return {
            'success': True,
            'message': '2FA recovery completed successfully',
            'backup_codes': backup_codes
        }

    # User Recovery Code Methods
    def set_user_recovery_code(self, user_id: str, recovery_code: str) -> dict:
        """Set user-defined recovery code."""
        if not recovery_code or len(recovery_code) < 8:
            return {'success': False, 'errors': ['Recovery code must be at least 8 characters']}

        try:
            if self.user_model.set_user_recovery_code(user_id, recovery_code):
                return {'success': True, 'message': 'Recovery code set successfully'}
            else:
                return {'success': False, 'errors': ['Failed to set recovery code']}
        except Exception as e:
            return {'success': False, 'errors': ['Failed to set recovery code']}

    def verify_user_recovery_code_for_reset(self, email: str, recovery_code: str) -> dict:
        """Verify user recovery code for account recovery (email already verified)."""
        try:
            user = self.user_model.get_user_by_email(email.lower().strip())
            if not user:
                return {'success': False, 'errors': ['Invalid recovery credentials']}

            user_id = str(user['_id'])

            if not self.user_model.verify_user_recovery_code(user_id, recovery_code):
                return {'success': False, 'errors': ['Invalid recovery code']}

            # Reset TOTP and return new secret
            new_secret = self.user_model.reset_totp_with_new_secret(user_id)
            qr_data = self.user_model.get_totp_qr_data(user_id)

            # Send notification email
            self.email_service.send_2fa_reset_notification(user['email'], user['username'])

            return {
                'success': True,
                'message': '2FA reset successfully',
                'totp_qr_data': qr_data,
                'totp_secret': new_secret,
                'user_id': user_id
            }

        except Exception as e:
            return {'success': False, 'errors': ['Recovery failed']}

    # Passkey Methods
    def generate_passkey_registration_options(self, user_id: str) -> dict:
        """Generate passkey registration options."""
        try:
            user = self.user_model.get_user_by_id(user_id)
            if not user:
                return {'success': False, 'errors': ['User not found']}

            result = self.passkey_service.generate_registration_options(
                user_id=user_id,
                username=user['username'],
                display_name=user.get('username')
            )

            if result.get('success'):
                # Store challenge in session for verification
                session['passkey_challenge'] = result['challenge']

            return result

        except Exception as e:
            return {'success': False, 'errors': ['Failed to generate passkey options']}

    def verify_passkey_registration(self, user_id: str, credential: dict) -> dict:
        """Verify and store passkey registration."""
        try:
            # Get challenge from session
            expected_challenge = session.get('passkey_challenge')
            if not expected_challenge:
                return {'success': False, 'errors': ['No challenge found. Please try again.']}

            # Decode challenge
            challenge_bytes = base64.urlsafe_b64decode(expected_challenge)

            # Verify the registration
            credential_data = self.passkey_service.verify_registration(credential, challenge_bytes)

            if not credential_data:
                return {'success': False, 'errors': ['Passkey registration verification failed']}

            # Store credential
            if self.user_model.add_passkey_credential(user_id, credential_data):
                # Clear challenge from session
                session.pop('passkey_challenge', None)

                return {
                    'success': True,
                    'message': 'Passkey registered successfully',
                    'credential_id': credential_data['credential_id']
                }
            else:
                return {'success': False, 'errors': ['Failed to store passkey']}

        except Exception as e:
            return {'success': False, 'errors': [f'Passkey registration failed: {str(e)}']}

    def generate_passkey_authentication_options(self, identifier: str = None) -> dict:
        """Generate passkey authentication options."""
        try:
            credentials = []

            # If identifier provided, get user's credentials
            if identifier:
                user = self.user_model.verify_user_by_username_or_email(identifier)
                if user:
                    credentials = self.user_model.get_passkey_credentials(str(user['_id']))

            result = self.passkey_service.generate_authentication_options(credentials)

            if result.get('success'):
                # Store challenge in session for verification
                session['passkey_auth_challenge'] = result['challenge']

            return result

        except Exception as e:
            return {'success': False, 'errors': ['Failed to generate authentication options']}

    def verify_passkey_authentication(self, credential: dict, identifier: str = None) -> dict:
        """Verify passkey authentication and log user in."""
        try:
            # Get challenge from session
            expected_challenge = session.get('passkey_auth_challenge')
            if not expected_challenge:
                return {'success': False, 'errors': ['No challenge found. Please try again.']}

            # Decode challenge
            challenge_bytes = base64.urlsafe_b64decode(expected_challenge)

            # Get credential ID from response
            credential_id = credential.get('id')
            if not credential_id:
                return {'success': False, 'errors': ['Invalid credential']}

            # Find user by credential ID
            user = None
            if identifier:
                user = self.user_model.verify_user_by_username_or_email(identifier)

            if not user:
                # Search all users for this credential (not ideal, but necessary for usernameless flow)
                return {'success': False, 'errors': ['User not found. Please provide username/email.']}

            user_id = str(user['_id'])

            # Get stored credential
            stored_credential = self.user_model.get_passkey_credential_by_id(user_id, credential_id)
            if not stored_credential:
                return {'success': False, 'errors': ['Passkey not found']}

            # Verify authentication
            new_sign_count = self.passkey_service.verify_authentication(
                credential,
                challenge_bytes,
                stored_credential
            )

            if new_sign_count is None:
                return {'success': False, 'errors': ['Passkey verification failed']}

            # Update sign count
            self.user_model.update_passkey_credential_counter(user_id, credential_id, new_sign_count)

            # Check if user is banned
            if self.user_model.is_user_banned(user_id):
                return {'success': False, 'errors': ['Account is banned']}

            # Check if email is verified
            if not user.get('email_verified', False):
                return {'success': False, 'errors': ['Email not verified']}

            # Create session
            session['user_id'] = user_id
            session['username'] = user['username']
            session['authenticated'] = True
            session['login_time'] = datetime.utcnow().isoformat()
            session['auth_method'] = 'passkey'

            # Clear challenge from session
            session.pop('passkey_auth_challenge', None)

            return {
                'success': True,
                'user': {
                    'id': user_id,
                    'username': user['username'],
                    'email': user['email'],
                    'preferences': user.get('preferences', {}),
                    'totp_enabled': user.get('totp_enabled', False)
                }
            }

        except Exception as e:
            return {'success': False, 'errors': [f'Passkey authentication failed: {str(e)}']}

    def get_user_passkeys(self, user_id: str) -> dict:
        """Get list of user's registered passkeys."""
        try:
            credentials = self.user_model.get_passkey_credentials(user_id)

            # Return sanitized credentials (without sensitive data)
            passkeys = []
            for cred in credentials:
                passkeys.append({
                    'credential_id': cred['credential_id'],
                    'created_at': cred.get('created_at'),
                    'last_used': cred.get('last_used'),
                    'device_name': cred.get('device_name', 'Unnamed device')
                })

            return {
                'success': True,
                'passkeys': passkeys
            }

        except Exception as e:
            return {'success': False, 'errors': ['Failed to retrieve passkeys']}

    def remove_passkey(self, user_id: str, credential_id: str) -> dict:
        """Remove a passkey credential."""
        try:
            if self.user_model.remove_passkey_credential(user_id, credential_id):
                return {'success': True, 'message': 'Passkey removed successfully'}
            else:
                return {'success': False, 'errors': ['Failed to remove passkey']}

        except Exception as e:
            return {'success': False, 'errors': ['Failed to remove passkey']}
