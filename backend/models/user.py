from datetime import datetime
from typing import List, Dict, Optional, Any
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
import pyotp
import bcrypt
from cryptography.fernet import Fernet
import os
import base64


class User:
    """User model for authentication and profile management."""

    def __init__(self, db):
        self.db = db
        self.collection = db.users
        self.encryption_key = self._get_or_create_encryption_key()

    def _get_or_create_encryption_key(self) -> bytes:
        """Get or create encryption key for TOTP secrets. Prioritizes environment variables."""
        import os
        import logging
        logger = logging.getLogger(__name__)

        # Prioritize environment variable for Azure and production stability
        env_key = os.environ.get('ENCRYPTION_KEY')
        if env_key:
            try:
                # Ensure it's a valid Fernet key
                from cryptography.fernet import Fernet
                Fernet(env_key.encode())
                logger.info("Using encryption key from environment variable")
                return env_key.encode()
            except Exception as e:
                logger.error(f"Invalid ENCRYPTION_KEY in environment: {str(e)}")

        key_file = 'totp_encryption.key'
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
            from cryptography.fernet import Fernet
            key = Fernet.generate_key()
            with open(key_file, 'wb') as f:
                f.write(key)
            return key

    def _encrypt_totp_secret(self, secret: str) -> str:
        """Encrypt TOTP secret before storing."""
        f = Fernet(self.encryption_key)
        return f.encrypt(secret.encode()).decode()

    def _decrypt_totp_secret(self, encrypted_secret: str) -> str:
        """Decrypt TOTP secret from database."""
        try:
            f = Fernet(self.encryption_key)
            return f.decrypt(encrypted_secret.encode()).decode()
        except Exception:
            return None

    def create_user(self, username: str, email: str, password: Optional[str] = None,
                   phone: Optional[str] = None, security_questions: Optional[List[Dict]] = None) -> str:
        """Create a new user with TOTP setup. Password is optional for passwordless auth."""
        # Check if username or email already exists
        # Note: For passwordless registration, the service layer handles incomplete registrations
        existing_username = self.collection.find_one({'username': username})
        if existing_username:
            raise ValueError('Username already exists')

        existing_email = self.collection.find_one({'email': email})
        if existing_email:
            raise ValueError('Email already exists')

        # Generate TOTP secret
        totp_secret = pyotp.random_base32()
        encrypted_secret = self._encrypt_totp_secret(totp_secret)

        # Hash password if provided (for backward compatibility)
        password_hash = generate_password_hash(password) if password else None

        # Hash security question answers if provided
        if security_questions:
            for question in security_questions:
                question['answer_hash'] = generate_password_hash(question['answer'])
                del question['answer']

        user_data = {
            'username': username,
            'email': email,
            'phone': phone,
            'password_hash': password_hash,  # Optional for passwordless auth
            'totp_secret': encrypted_secret,
            'totp_enabled': False,  # Enabled after verification
            'email_verified': False,  # Email verification status
            'email_verification_code': None,  # Verification code
            'email_verification_expires': None,  # Verification code expiry
            'security_questions': security_questions or [],
            'is_admin': False,  # Admin status
            'is_banned': False,
            'ban_reason': None,
            'ban_expiry': None,
            'banned_at': None,  # When the user was banned
            'ip_addresses': [],
            'created_at': datetime.utcnow(),
            'last_login': None,
            'last_online': None,  # Timestamp of last WebSocket disconnect
            'preferences': {
                'theme': 'dark',
                'language': 'pt',
                'anonymous_mode': False
            },
            'backup_codes': [],  # Will be generated during TOTP setup
            'recovery_code': None,  # Recovery email code (for email verification)
            'recovery_expires': None,  # Recovery code expiry
            'original_totp_secret_hash': None,  # Hashed original secret for recovery
            'user_recovery_code_hash': None,  # User-defined recovery code (like a master password)
            'passkey_credentials': [],  # WebAuthn/Passkey credentials for biometric auth
            'blocked_users': [],  # Array of user_ids that this user has blocked
            'active_warning': None,  # Current active warning: {message, warned_at, warned_by, dismissed_at}
            'warning_history': [],  # Array of past warnings
            'country_code': None  # ISO 3166-1 alpha-2 country code (e.g., 'PT', 'US')
        }

        result = self.collection.insert_one(user_data)
        return str(result.inserted_id)

    def verify_credentials(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """Verify user credentials for login."""
        user = self.collection.find_one({'username': username})
        if not user:
            return None

        if check_password_hash(user['password_hash'], password):
            # Update last login
            self.collection.update_one(
                {'_id': user['_id']},
                {'$set': {'last_login': datetime.utcnow()}}
            )
            return user
        return None

    def verify_totp(self, user_id: str, token: str, require_enabled: bool = True) -> bool:
        """Verify TOTP token for user.

        Args:
            user_id: User ID to verify token for
            token: TOTP token to verify
            require_enabled: If True, only verify if TOTP is already enabled (for login).
                           If False, verify even if not enabled yet (for initial setup).
        """
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f"[VERIFY_TOTP] user_id: {user_id}, token: {token}, require_enabled: {require_enabled}")

        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            logger.error(f"[VERIFY_TOTP] User not found: {user_id}")
            return False

        totp_enabled = user.get('totp_enabled', False)
        logger.info(f"[VERIFY_TOTP] TOTP enabled status: {totp_enabled}")

        # Only check if TOTP is enabled when require_enabled is True (during login)
        if require_enabled and not totp_enabled:
            logger.warning(f"[VERIFY_TOTP] TOTP not enabled and require_enabled=True")
            return False

        totp_secret = self._decrypt_totp_secret(user['totp_secret'])
        if not totp_secret:
            logger.error(f"[VERIFY_TOTP] Failed to decrypt TOTP secret")
            return False

        logger.info(f"[VERIFY_TOTP] TOTP secret retrieved: {totp_secret[:4]}...")

        totp = pyotp.TOTP(totp_secret)

        # Get current time and expected codes
        import time
        current_time = int(time.time())
        time_step = current_time // 30
        current_code = totp.now()

        logger.info(f"[VERIFY_TOTP] Current time: {current_time}, Time step: {time_step}")
        logger.info(f"[VERIFY_TOTP] Expected code: {current_code}, Received code: {token}")
        logger.info(f"[VERIFY_TOTP] Previous code: {totp.at(current_time - 30)}")
        logger.info(f"[VERIFY_TOTP] Next code: {totp.at(current_time + 30)}")

        result = totp.verify(token, valid_window=1)
        logger.info(f"[VERIFY_TOTP] Verification result: {result}")

        return result

    def verify_totp_setup(self, user_id: str, token: str) -> bool:
        """Verify TOTP token during initial setup (before totp_enabled is True)."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return False

        totp_secret = self._decrypt_totp_secret(user.get('totp_secret'))
        if not totp_secret:
            return False

        totp = pyotp.TOTP(totp_secret)
        return totp.verify(token, valid_window=1)

    def enable_totp(self, user_id: str) -> bool:
        """Enable TOTP for user after successful verification."""
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'totp_enabled': True}}
        )
        return result.modified_count > 0

    def update_country_code(self, user_id: str, country_code: str) -> bool:
        """Update user's country code."""
        if not country_code or len(country_code) != 2:
            return False
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'country_code': country_code.upper()}}
        )
        return result.modified_count > 0

    def get_totp_secret(self, user_id: str) -> Optional[str]:
        """Get decrypted TOTP secret for QR code generation."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return None
        return self._decrypt_totp_secret(user['totp_secret'])

    def get_totp_qr_data(self, user_id: str, issuer: str = 'TopicsFlow') -> Optional[str]:
        """Get TOTP QR code data for authenticator app setup."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return None

        totp_secret = self._decrypt_totp_secret(user['totp_secret'])
        if not totp_secret:
            return None

        totp_uri = pyotp.totp.TOTP(totp_secret).provisioning_uri(
            name=user['username'],
            issuer_name=issuer
        )
        return totp_uri

    def generate_backup_codes(self, user_id: str) -> List[str]:
        """Generate backup codes for account recovery."""
        import random
        import string

        backup_codes = []
        for _ in range(10):
            code = ''.join(random.choices(string.digits, k=8))
            backup_codes.append(code)

        # Store hashed backup codes
        hashed_codes = [generate_password_hash(code) for code in backup_codes]
        self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'backup_codes': hashed_codes}}
        )

        return backup_codes

    def verify_backup_code(self, user_id: str, code: str) -> bool:
        """Verify and consume a backup code."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user['backup_codes']:
            return False

        for i, hashed_code in enumerate(user['backup_codes']):
            if check_password_hash(hashed_code, code):
                # Remove used backup code
                self.collection.update_one(
                    {'_id': ObjectId(user_id)},
                    {'$pull': {'backup_codes': hashed_code}}
                )
                return True

        return False

    def reset_totp(self, user_id: str) -> str:
        """Reset TOTP for user and return new secret."""
        new_secret = pyotp.random_base32()
        encrypted_secret = self._encrypt_totp_secret(new_secret)

        self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'totp_secret': encrypted_secret,
                    'totp_enabled': False,
                    'backup_codes': []
                }
            }
        )

        return new_secret

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user by ID."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if user:
            # Recursively convert all ObjectIds and datetimes
            def convert_objectids(obj):
                if isinstance(obj, ObjectId):
                    return str(obj)
                elif isinstance(obj, dict):
                    return {k: convert_objectids(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_objectids(item) for item in obj]
                elif isinstance(obj, datetime):
                    return obj.isoformat()
                return obj
            
            # Convert all ObjectIds and datetimes in the user dict
            user = convert_objectids(user)
            # Ensure id field is set
            user['id'] = user['_id']
        return user

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username."""
        user = self.collection.find_one({'username': username})
        if user:
            # Convert ObjectId to string
            user['_id'] = str(user['_id'])
            user['id'] = str(user['_id'])
            
            # Convert any other ObjectId fields recursively
            def convert_objectids(obj):
                if isinstance(obj, ObjectId):
                    return str(obj)
                elif isinstance(obj, dict):
                    return {k: convert_objectids(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    return [convert_objectids(item) for item in obj]
                elif isinstance(obj, datetime):
                    return obj.isoformat()
                return obj
            
            # Convert all ObjectIds and datetimes in the user dict
            for key, value in list(user.items()):
                if isinstance(value, ObjectId):
                    user[key] = str(value)
                elif isinstance(value, datetime):
                    user[key] = value.isoformat()
                elif isinstance(value, dict):
                    user[key] = convert_objectids(value)
                elif isinstance(value, list):
                    user[key] = convert_objectids(value)
        return user

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        return self.collection.find_one({'email': email})

    def update_user_preferences(self, user_id: str, preferences: Dict[str, Any]) -> bool:
        """Update user preferences."""
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'preferences': preferences}}
        )
        return result.modified_count > 0

    def update_user(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user profile data."""
        # Remove None values and empty strings
        update_data = {k: v for k, v in update_data.items() if v is not None and v != ''}
        
        if not update_data:
            return False
        
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0

    def add_ip_address(self, user_id: str, ip_address: str) -> None:
        """Add IP address to user's IP history."""
        self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$addToSet': {'ip_addresses': ip_address}}
        )

    def ban_user(self, user_id: str, reason: str, admin_id: str, duration_days: Optional[int] = None) -> bool:
        """Ban a user temporarily or permanently.

        Args:
            user_id: ID of user to ban
            reason: Reason for ban
            admin_id: ID of admin performing the ban
            duration_days: Optional duration in days (None = permanent)

        Returns:
            True if ban successful, False otherwise
        """
        update_data = {
            'is_banned': True,
            'ban_reason': reason,
            'banned_at': datetime.utcnow(),
            'banned_by': ObjectId(admin_id)
        }

        if duration_days:
            from datetime import timedelta
            update_data['ban_expiry'] = datetime.utcnow() + timedelta(days=duration_days)
        else:
            update_data['ban_expiry'] = None

        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0

    def unban_user(self, user_id: str, admin_id: str) -> bool:
        """Unban a user.

        Args:
            user_id: ID of user to unban
            admin_id: ID of admin performing the unban

        Returns:
            True if unban successful, False otherwise
        """
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'is_banned': False,
                'ban_reason': None,
                'ban_expiry': None,
                'banned_at': None,
                'banned_by': None,
                'unbanned_at': datetime.utcnow(),
                'unbanned_by': ObjectId(admin_id)
            }}
        )
        return result.modified_count > 0

    def is_user_banned(self, user_id: str) -> bool:
        """Check if user is currently banned."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user['is_banned']:
            return False

        # Check if ban has expired
        if user['ban_expiry'] and user['ban_expiry'] < datetime.utcnow():
            self.unban_user(user_id)
            return False

        return True

    def get_ban_info(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get ban information for a user."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user.get('is_banned'):
            return None

        # Check if ban has expired
        if user.get('ban_expiry') and user['ban_expiry'] < datetime.utcnow():
            self.unban_user(user_id)
            return None

        return {
            'reason': user.get('ban_reason', 'No reason provided'),
            'expiry': user.get('ban_expiry'),
            'banned_at': user.get('banned_at')
        }

    def warn_user(self, user_id: str, warning_message: str, admin_id: str, report_id: Optional[str] = None) -> bool:
        """Warn a user for violating community guidelines.

        Args:
            user_id: ID of user to warn
            warning_message: Warning message to display to user
            admin_id: ID of admin issuing the warning
            report_id: Optional report ID that triggered the warning

        Returns:
            True if warning successful, False otherwise
        """
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return False

        # If there's an existing active warning, move it to history
        if user.get('active_warning'):
            warning_history = user.get('warning_history', [])
            warning_history.append(user['active_warning'])
        else:
            warning_history = user.get('warning_history', [])

        # Create new active warning
        active_warning = {
            'message': warning_message,
            'warned_at': datetime.utcnow(),
            'warned_by': ObjectId(admin_id),
            'dismissed_at': None
        }
        
        if report_id:
            active_warning['report_id'] = ObjectId(report_id)

        # Update user with new warning
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'active_warning': active_warning,
                    'warning_history': warning_history
                }
            }
        )
        
        return result.modified_count > 0

    def dismiss_warning(self, user_id: str) -> bool:
        """Dismiss the active warning for a user (user manually dismisses it).

        Args:
            user_id: ID of user dismissing the warning

        Returns:
            True if dismissal successful, False otherwise
        """
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user.get('active_warning'):
            return False

        # Move active warning to history with dismissed_at timestamp
        active_warning = user['active_warning'].copy()
        active_warning['dismissed_at'] = datetime.utcnow()
        
        warning_history = user.get('warning_history', [])
        warning_history.append(active_warning)

        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'active_warning': None,
                    'warning_history': warning_history
                }
            }
        )
        
        return result.modified_count > 0

    def clear_warning(self, user_id: str) -> bool:
        """Clear the active warning after it expires (10 seconds auto-clear).

        Args:
            user_id: ID of user whose warning should be cleared

        Returns:
            True if clear successful, False otherwise
        """
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user.get('active_warning'):
            return False

        # Move active warning to history without dismissed_at (auto-cleared)
        active_warning = user['active_warning'].copy()
        
        warning_history = user.get('warning_history', [])
        warning_history.append(active_warning)

        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'active_warning': None,
                    'warning_history': warning_history
                }
            }
        )
        
        return result.modified_count > 0

    def verify_security_questions(self, username: str, answers: List[str]) -> bool:
        """Verify security question answers for account recovery."""
        user = self.collection.find_one({'username': username})
        if not user or not user['security_questions']:
            return False

        # Check if at least 2 out of 3 answers are correct
        correct_count = 0
        for i, question in enumerate(user['security_questions']):
            if i < len(answers) and check_password_hash(question['answer_hash'], answers[i]):
                correct_count += 1

        return correct_count >= 2

    def change_password(self, user_id: str, new_password: str) -> bool:
        """Change user password."""
        password_hash = generate_password_hash(new_password)
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'password_hash': password_hash}}
        )
        return result.modified_count > 0

    # Email Verification Methods
    def set_email_verification_code(self, user_id: str, code: str, expires_in_minutes: int = 15) -> bool:
        """Set email verification code with expiry."""
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)

        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'email_verification_code': code,
                'email_verification_expires': expires_at
            }}
        )
        return result.modified_count > 0

    def verify_email_code(self, user_id: str, code: str) -> bool:
        """Verify email verification code."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return False

        # Check if code matches and hasn't expired
        if (user.get('email_verification_code') == code and
            user.get('email_verification_expires') and
            user['email_verification_expires'] > datetime.utcnow()):

            # Mark email as verified and clear verification code
            self.collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$set': {
                    'email_verified': True,
                    'email_verification_code': None,
                    'email_verification_expires': None
                }}
            )
            return True

        return False

    def is_email_verified(self, user_id: str) -> bool:
        """Check if user's email is verified."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        return user.get('email_verified', False) if user else False

    # Passwordless Authentication Methods
    def verify_user_by_username_or_email(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Find user by username or email for passwordless auth."""
        user = self.collection.find_one({
            '$or': [
                {'username': identifier},
                {'email': identifier.lower()}
            ]
        })
        return user

    def verify_totp_only(self, identifier: str, token: str) -> Optional[Dict[str, Any]]:
        """Verify user with username/email and TOTP token only (passwordless)."""
        import logging
        import time
        logger = logging.getLogger(__name__)

        logger.info(f"[LOGIN] Attempting passwordless login for identifier: {identifier}")
        logger.info(f"[LOGIN] Received TOTP code: {token} (length: {len(token) if token else 0})")

        user = self.verify_user_by_username_or_email(identifier)
        if not user:
            logger.error(f"[LOGIN] User not found with identifier: {identifier}")
            return None

        totp_enabled = user.get('totp_enabled', False)
        logger.info(f"[LOGIN] User found: {user.get('username')}, TOTP enabled: {totp_enabled}")

        if not totp_enabled:
            logger.warning(f"[LOGIN] TOTP not enabled for user: {user.get('username')}")
            return None

        # Verify TOTP
        totp_secret = self._decrypt_totp_secret(user['totp_secret'])
        if not totp_secret:
            logger.error(f"[LOGIN] Failed to decrypt TOTP secret for user: {user.get('username')}")
            return None

        logger.info(f"[LOGIN] TOTP secret retrieved: {totp_secret[:4]}...")

        totp = pyotp.TOTP(totp_secret)

        # Get current time and expected codes for debugging
        current_time = int(time.time())
        time_step = current_time // 30
        current_code = totp.now()

        logger.info(f"[LOGIN] Current time: {current_time}, Time step: {time_step}")
        logger.info(f"[LOGIN] Expected code: {current_code}, Received code: {token}")
        logger.info(f"[LOGIN] Previous code: {totp.at(current_time - 30)}")
        logger.info(f"[LOGIN] Next code: {totp.at(current_time + 30)}")

        result = totp.verify(token, valid_window=1)
        logger.info(f"[LOGIN] TOTP verification result: {result}")

        if result:
            # Update last login
            self.collection.update_one(
                {'_id': user['_id']},
                {'$set': {'last_login': datetime.utcnow()}}
            )
            logger.info(f"[LOGIN] Login successful for user: {user.get('username')}")
            return user

        logger.warning(f"[LOGIN] Login failed - invalid TOTP code for user: {user.get('username')}")
        return None

    def verify_backup_code_only(self, identifier: str, backup_code: str) -> Optional[Dict[str, Any]]:
        """Verify user with username/email and backup code only (passwordless)."""
        import logging
        logger = logging.getLogger(__name__)

        logger.info(f"[BACKUP LOGIN] Attempting backup code login for identifier: {identifier}")
        logger.info(f"[BACKUP LOGIN] Received backup code: {backup_code[:4]}... (length: {len(backup_code) if backup_code else 0})")

        user = self.verify_user_by_username_or_email(identifier)
        if not user:
            logger.error(f"[BACKUP LOGIN] User not found with identifier: {identifier}")
            return None

        totp_enabled = user.get('totp_enabled', False)
        logger.info(f"[BACKUP LOGIN] User found: {user.get('username')}, TOTP enabled: {totp_enabled}")

        if not totp_enabled:
            logger.warning(f"[BACKUP LOGIN] TOTP not enabled for user: {user.get('username')}")
            return None

        # Verify backup code
        user_id = str(user['_id'])
        if self.verify_backup_code(user_id, backup_code):
            # Update last login
            self.collection.update_one(
                {'_id': user['_id']},
                {'$set': {'last_login': datetime.utcnow()}}
            )
            logger.info(f"[BACKUP LOGIN] Login successful for user: {user.get('username')}")
            return user

        logger.warning(f"[BACKUP LOGIN] Login failed - invalid backup code for user: {user.get('username')}")
        return None

    # Account Recovery Methods
    def set_recovery_code(self, email: str, code: str, expires_in_minutes: int = 15) -> bool:
        """Set recovery code for account recovery."""
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)

        result = self.collection.update_one(
            {'email': email.lower()},
            {'$set': {
                'recovery_code': code,
                'recovery_expires': expires_at
            }}
        )
        return result.modified_count > 0

    def verify_recovery_code(self, email: str, code: str) -> Optional[str]:
        """Verify recovery code and return user_id if valid."""
        user = self.collection.find_one({'email': email.lower()})
        if not user:
            return None

        # Check if code matches and hasn't expired
        if (user.get('recovery_code') == code and
            user.get('recovery_expires') and
            user['recovery_expires'] > datetime.utcnow()):
            return str(user['_id'])

        return None

    def store_original_totp_secret(self, user_id: str, original_secret: str) -> bool:
        """Store hash of original TOTP secret for recovery purposes."""
        secret_hash = generate_password_hash(original_secret)
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'original_totp_secret_hash': secret_hash}}
        )
        return result.modified_count > 0

    def verify_original_totp_secret(self, user_id: str, secret: str) -> bool:
        """Verify original TOTP secret for account recovery."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user.get('original_totp_secret_hash'):
            return False

        return check_password_hash(user['original_totp_secret_hash'], secret)

    def reset_totp_with_new_secret(self, user_id: str) -> str:
        """Reset TOTP completely with new secret and clear recovery codes."""
        new_secret = pyotp.random_base32()
        encrypted_secret = self._encrypt_totp_secret(new_secret)

        self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$set': {
                    'totp_secret': encrypted_secret,
                    'totp_enabled': False,  # Needs to be enabled again
                    'backup_codes': [],
                    'recovery_code': None,
                    'recovery_expires': None
                }
            }
        )

        return new_secret

    # Account Deletion Methods
    def set_deletion_code(self, user_id: str, code: str, expires_in_minutes: int = 15) -> bool:
        """Set account deletion verification code with expiry."""
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)

        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'deletion_code': code,
                'deletion_expires': expires_at
            }}
        )
        return result.modified_count > 0

    def verify_deletion_code(self, user_id: str, code: str) -> bool:
        """Verify account deletion code."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return False

        # Check if code matches and hasn't expired
        if (user.get('deletion_code') == code and
            user.get('deletion_expires') and
            user['deletion_expires'] > datetime.utcnow()):
            return True

        return False

    def delete_user_permanently(self, user_id: str) -> bool:
        """Permanently delete a user and all their data."""
        # Note: This is a hard delete. In a real production app, you might want to soft delete
        # or anonymize data, but the requirement is to "permanently delete".
        
        # Additional cleanup should be done here or triggered via signals/hooks
        # (e.g. deleting messages, files, etc. depending on cascading rules)
        
        result = self.collection.delete_one({'_id': ObjectId(user_id)})
        return result.deleted_count > 0

    def set_user_recovery_code(self, user_id: str, recovery_code: str) -> bool:
        """Set user-defined recovery code (hashed)."""
        recovery_code_hash = generate_password_hash(recovery_code)
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'user_recovery_code_hash': recovery_code_hash}}
        )
        return result.modified_count > 0 or result.matched_count > 0



    def verify_user_recovery_code(self, user_id: str, recovery_code: str) -> bool:
        """Verify user-defined recovery code."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user.get('user_recovery_code_hash'):
            return False
        return check_password_hash(user['user_recovery_code_hash'], recovery_code)

    def has_user_recovery_code(self, user_id: str) -> bool:
        """Check if user has set a recovery code."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        return bool(user and user.get('user_recovery_code_hash'))

    # Passkey/WebAuthn Methods
    def add_passkey_credential(self, user_id: str, credential_data: Dict[str, Any]) -> bool:
        """Add a passkey credential for WebAuthn authentication."""
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$push': {'passkey_credentials': credential_data}}
        )
        return result.modified_count > 0

    def get_passkey_credentials(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all passkey credentials for a user."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return []
        return user.get('passkey_credentials', [])

    def get_passkey_credential_by_id(self, user_id: str, credential_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific passkey credential by ID."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return None

        for credential in user.get('passkey_credentials', []):
            if credential.get('credential_id') == credential_id:
                return credential
        return None

    def update_passkey_credential_counter(self, user_id: str, credential_id: str, new_counter: int) -> bool:
        """Update the sign count for a passkey credential (prevents replay attacks)."""
        result = self.collection.update_one(
            {
                '_id': ObjectId(user_id),
                'passkey_credentials.credential_id': credential_id
            },
            {'$set': {'passkey_credentials.$.sign_count': new_counter}}
        )
        return result.modified_count > 0

    def remove_passkey_credential(self, user_id: str, credential_id: str) -> bool:
        """Remove a passkey credential."""
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$pull': {'passkey_credentials': {'credential_id': credential_id}}}
        )
        return result.modified_count > 0

    def update_profile(self, user_id: str, update_data: Dict[str, Any]) -> bool:
        """Update user profile information."""
        if '_id' in update_data:
            del update_data['_id']
        if 'id' in update_data:
            del update_data['id']
        
        update_data['updated_at'] = datetime.utcnow()
        
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0
    
    def block_user(self, blocker_id: str, blocked_id: str) -> bool:
        """Block a user."""
        result = self.collection.update_one(
            {'_id': ObjectId(blocker_id)},
            {'$addToSet': {'blocked_users': ObjectId(blocked_id)}}
        )
        return result.modified_count > 0 or result.matched_count > 0
    
    def unblock_user(self, blocker_id: str, blocked_id: str) -> bool:
        """Unblock a user."""
        result = self.collection.update_one(
            {'_id': ObjectId(blocker_id)},
            {'$pull': {'blocked_users': ObjectId(blocked_id)}}
        )
        return result.modified_count > 0
    
    def update_last_online(self, user_id: str) -> bool:
        """Update last_online timestamp when user disconnects from WebSocket."""
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'last_online': datetime.utcnow()}}
        )
        return result.modified_count > 0 or result.matched_count > 0


    def has_passkeys(self, user_id: str) -> bool:
        """Check if user has any passkey credentials registered."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        return bool(user and user.get('passkey_credentials'))
    
    def search_users(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Search users by username or email."""
        search_query = {
            '$or': [
                {'username': {'$regex': query, '$options': 'i'}},
                {'email': {'$regex': query, '$options': 'i'}}
            ]
        }
        
        users = list(self.collection.find(search_query)
                    .limit(limit))
        
        result = []
        for user in users:
            result.append({
                'id': str(user['_id']),
                'username': user.get('username', ''),
                'email': user.get('email', ''),
                'profile_picture': user.get('profile_picture')
            })
        
        return result

    def get_blocked_users(self, user_id: str) -> List[Dict[str, Any]]:
        """Get list of users blocked by this user."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return []
        
        blocked_user_ids = user.get('blocked_users', [])
        if not blocked_user_ids:
            return []
        
        blocked_users = list(self.collection.find(
            {'_id': {'$in': blocked_user_ids}},
            {'username': 1, 'email': 1, 'profile_picture': 1}
        ))
        
        result = []
        for blocked_user in blocked_users:
            result.append({
                'id': str(blocked_user['_id']),
                'username': blocked_user.get('username', ''),
                'email': blocked_user.get('email', ''),
                'profile_picture': blocked_user.get('profile_picture')
            })
        
        return result

    def is_user_blocked(self, user_id: str, other_user_id: str) -> bool:
        """Check if a user has blocked another user."""
        user = self.collection.find_one({
            '_id': ObjectId(user_id),
            'blocked_users': ObjectId(other_user_id)
        })
        return user is not None