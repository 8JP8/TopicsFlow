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

    def create_user(self, username: str, email: str, password: str,
                   phone: Optional[str] = None, security_questions: Optional[List[Dict]] = None) -> str:
        """Create a new user with TOTP setup."""
        # Check if username or email already exists
        if self.collection.find_one({'username': username}):
            raise ValueError('Username already exists')
        if self.collection.find_one({'email': email}):
            raise ValueError('Email already exists')

        # Generate TOTP secret
        totp_secret = pyotp.random_base32()
        encrypted_secret = self._encrypt_totp_secret(totp_secret)

        # Hash password
        password_hash = generate_password_hash(password)

        # Hash security question answers if provided
        if security_questions:
            for question in security_questions:
                question['answer_hash'] = generate_password_hash(question['answer'])
                del question['answer']

        user_data = {
            'username': username,
            'email': email,
            'phone': phone,
            'password_hash': password_hash,
            'totp_secret': encrypted_secret,
            'totp_enabled': False,  # Enabled after verification
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
            'backup_codes': []  # Will be generated during TOTP setup
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