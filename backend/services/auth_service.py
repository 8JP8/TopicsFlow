from flask import session
from datetime import datetime, timedelta
import pyotp
import secrets
from models.user import User
from utils.validators import validate_username, validate_email
from utils.content_filter import contains_profanity


class AuthService:
    """Service for handling authentication and TOTP operations."""

    def __init__(self, db):
        self.db = db
        self.user_model = User(db)

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