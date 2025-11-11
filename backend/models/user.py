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
        """Get or create encryption key for TOTP secrets."""
        key_file = 'totp_encryption.key'
        if os.path.exists(key_file):
            with open(key_file, 'rb') as f:
                return f.read()
        else:
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
        if self.collection.find_one({'username': username}):
            raise ValueError('Username already exists')
        if self.collection.find_one({'email': email}):
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
            'is_banned': False,
            'ban_reason': None,
            'ban_expiry': None,
            'ip_addresses': [],
            'created_at': datetime.utcnow(),
            'last_login': None,
            'preferences': {
                'theme': 'dark',
                'language': 'en',
                'anonymous_mode': False
            },
            'backup_codes': [],  # Will be generated during TOTP setup
            'recovery_code': None,  # Recovery email code (for email verification)
            'recovery_expires': None,  # Recovery code expiry
            'original_totp_secret_hash': None,  # Hashed original secret for recovery
            'user_recovery_code_hash': None,  # User-defined recovery code (like a master password)
            'passkey_credentials': []  # WebAuthn/Passkey credentials for biometric auth
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

    def verify_totp(self, user_id: str, token: str) -> bool:
        """Verify TOTP token for user."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user or not user['totp_enabled']:
            return False

        totp_secret = self._decrypt_totp_secret(user['totp_secret'])
        if not totp_secret:
            return False

        totp = pyotp.TOTP(totp_secret)
        return totp.verify(token, valid_window=1)

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

    def get_totp_secret(self, user_id: str) -> Optional[str]:
        """Get decrypted TOTP secret for QR code generation."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return None
        return self._decrypt_totp_secret(user['totp_secret'])

    def get_totp_qr_data(self, user_id: str, issuer: str = 'ChatHub') -> Optional[str]:
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
        return self.collection.find_one({'_id': ObjectId(user_id)})

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username."""
        return self.collection.find_one({'username': username})

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

    def add_ip_address(self, user_id: str, ip_address: str) -> None:
        """Add IP address to user's IP history."""
        self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$addToSet': {'ip_addresses': ip_address}}
        )

    def ban_user(self, user_id: str, reason: str, duration_days: Optional[int] = None) -> bool:
        """Ban a user temporarily or permanently."""
        update_data = {
            'is_banned': True,
            'ban_reason': reason,
            'banned_at': datetime.utcnow()
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

    def unban_user(self, user_id: str) -> bool:
        """Unban a user."""
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {
                'is_banned': False,
                'ban_reason': None,
                'ban_expiry': None,
                'banned_at': None
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
        user = self.verify_user_by_username_or_email(identifier)
        if not user or not user.get('totp_enabled'):
            return None

        # Verify TOTP
        totp_secret = self._decrypt_totp_secret(user['totp_secret'])
        if not totp_secret:
            return None

        totp = pyotp.TOTP(totp_secret)
        if totp.verify(token, valid_window=1):
            # Update last login
            self.collection.update_one(
                {'_id': user['_id']},
                {'$set': {'last_login': datetime.utcnow()}}
            )
            return user

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

    # User-Defined Recovery Code Methods
    def set_user_recovery_code(self, user_id: str, recovery_code: str) -> bool:
        """Set user-defined recovery code (like a master password for account recovery)."""
        recovery_code_hash = generate_password_hash(recovery_code)
        result = self.collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'user_recovery_code_hash': recovery_code_hash}}
        )
        return result.modified_count > 0

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

    def has_passkeys(self, user_id: str) -> bool:
        """Check if user has any passkey credentials registered."""
        user = self.collection.find_one({'_id': ObjectId(user_id)})
        return bool(user and user.get('passkey_credentials'))