"""Email service using Resend API for sending verification and recovery emails."""
import os
import json
import requests
from typing import Optional, Dict, Any
import logging
from pathlib import Path
from datetime import datetime

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via Resend API."""

    def __init__(self):
        """Initialize email service with Resend API key."""
        self.api_key = os.getenv('RESEND_API_KEY')
        self.api_url = 'https://api.resend.com/emails'
        self.from_email = os.getenv('FROM_EMAIL', 'noreply@topicsflow.me')
        self.app_name = os.getenv('APP_NAME', 'TopicsFlow')
        self.locales = self._load_locales()

    def _load_locales(self) -> Dict[str, Any]:
        """Load locale files from backend/locales directory."""
        locales = {}
        base_path = Path(__file__).parent.parent / 'locales'
        
        # Ensure directory exists (create if not, though we just created it via tool)
        if not base_path.exists():
            base_path.mkdir(parents=True, exist_ok=True)
            
        for lang in ['en', 'pt']:
            file_path = base_path / f'{lang}.json'
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        locales[lang] = json.load(f)
                except Exception as e:
                    logger.error(f"Failed to load locale {lang}: {e}")
                    locales[lang] = {}
        return locales

    def get_text(self, key_path: str, lang: str = 'en', **kwargs) -> str:
        """Retrieve and format text from locale files."""
        # Default to 'en' if lang not found
        lang_data = self.locales.get(lang) or self.locales.get('en', {})
        
        # Configure variables for formatting
        kwargs['app_name'] = self.app_name
        kwargs['year'] = datetime.now().year
        
        # Traverse keys
        keys = key_path.split('.')
        value = lang_data
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            else:
                value = None
                break
        
        if not value or not isinstance(value, str):
            # Fallback to English if not found in requested lang
            if lang != 'en':
                return self.get_text(key_path, 'en', **kwargs)
            return key_path  # Return key as fallback

        try:
            return value.format(**kwargs)
        except KeyError as e:
            logger.error(f"Missing format key in {key_path}: {e}")
            return value

    def send_email(self, to_email: str, subject: str, html_content: str, text_content: Optional[str] = None) -> Dict[str, Any]:
        """Send an email using Resend API."""
        if not self.api_key:
            logger.error("Resend API key not configured")
            return {'success': False, 'error': 'Email service not configured'}

        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json'
        }

        payload = {
            'from': self.from_email,
            'to': [to_email],
            'subject': subject,
            'html': html_content
        }

        if text_content:
            payload['text'] = text_content

        try:
            response = requests.post(self.api_url, json=payload, headers=headers, timeout=10)

            if response.status_code == 200:
                logger.info(f"Email sent successfully to {to_email}")
                return {'success': True, 'data': response.json()}
            else:
                logger.error(f"Failed to send email: {response.status_code} - {response.text}")
                return {'success': False, 'error': f'Failed to send email: {response.status_code}'}

        except requests.exceptions.RequestException as e:
            logger.error(f"Email sending error: {str(e)}")
            return {'success': False, 'error': 'Failed to send email'}

    def _get_email_template(self, title_bg: str, title: str, body_content: str) -> str:
        """Helper to constructing the common HTML skeleton."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{title}</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="{title_bg}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">{title}</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                {body_content}
            </div>
        </body>
        </html>
        """

    def send_verification_email(self, to_email: str, username: str, verification_code: str, lang: str = 'en') -> Dict[str, Any]:
        """Send email verification code."""
        # Prepare content data
        data = {
            'username': username,
            'minutes': 15
        }
        
        subject = self.get_text('email.verification.subject', lang, **data)
        title = self.get_text('email.verification.title', lang, **data)
        
        body_content = f"""
            <p style="font-size: 16px;">{self.get_text('email.verification.greeting', lang, **data)}</p>

            <p style="font-size: 16px;">{self.get_text('email.verification.intro', lang, **data)}</p>

            <div style="background: white; border: 2px solid #1976d2; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="margin: 0; color: #666; font-size: 14px;">{self.get_text('email.verification.codeLabel', lang, **data)}</p>
                <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                    {verification_code}
                </p>
            </div>

            <p style="font-size: 14px; color: #666;">{self.get_text('email.verification.expiry', lang, **data)}</p>

            <p style="font-size: 14px; color: #666;">{self.get_text('email.verification.ignore', lang, **data)}</p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                {self.get_text('email.verification.footer', lang, **data).replace(chr(10), '<br>')}
            </p>
        """
        
        html_content = self._get_email_template(
            "background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)",
            title,
            body_content
        )

        text_content = f"{title}\n\n{self.get_text('email.verification.greeting', lang, **data)}\n\n{self.get_text('email.verification.intro', lang, **data)}\n\n{verification_code}\n\n{self.get_text('email.verification.expiry', lang, **data)}\n\n{self.get_text('email.verification.ignore', lang, **data)}"

        return self.send_email(to_email, subject, html_content, text_content)

    def send_recovery_email(self, to_email: str, username: str, recovery_code: str, lang: str = 'en') -> Dict[str, Any]:
        """Send account recovery email with verification code."""
        data = {
            'username': username,
            'minutes': 15
        }
        
        subject = self.get_text('email.recovery.subject', lang, **data)
        title = self.get_text('email.recovery.title', lang, **data)
        
        body_content = f"""
            <p style="font-size: 16px;">{self.get_text('email.recovery.greeting', lang, **data)}</p>

            <p style="font-size: 16px;">{self.get_text('email.recovery.intro', lang, **data)}</p>

            <div style="background: white; border: 2px solid #d32f2f; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="margin: 0; color: #666; font-size: 14px;">{self.get_text('email.recovery.codeLabel', lang, **data)}</p>
                <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #d32f2f; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                    {recovery_code}
                </p>
            </div>

            <p style="font-size: 14px; color: #666;">{self.get_text('email.recovery.expiry', lang, **data)}</p>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    {self.get_text('email.recovery.warning', lang, **data)}
                </p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                {self.get_text('email.recovery.footer', lang, **data).replace(chr(10), '<br>')}
            </p>
        """
        
        html_content = self._get_email_template(
            "background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)",
            title,
            body_content
        )

        text_content = f"{title}\n\n{self.get_text('email.recovery.greeting', lang, **data)}\n\n{self.get_text('email.recovery.intro', lang, **data)}\n\n{recovery_code}\n\n{self.get_text('email.recovery.expiry', lang, **data)}\n\n{self.get_text('email.recovery.warning', lang, **data)}"

        return self.send_email(to_email, subject, html_content, text_content)

    def send_2fa_reset_notification(self, to_email: str, username: str, lang: str = 'en') -> Dict[str, Any]:
        """Send notification that 2FA has been reset."""
        data = {
            'username': username
        }
        
        subject = self.get_text('email.twoFactorReset.subject', lang, **data)
        title = self.get_text('email.twoFactorReset.title', lang, **data)
        
        body_content = f"""
            <p style="font-size: 16px;">{self.get_text('email.twoFactorReset.greeting', lang, **data)}</p>

            <p style="font-size: 16px;">{self.get_text('email.twoFactorReset.intro', lang, **data)}</p>

            <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1565c0;">
                    {self.get_text('email.twoFactorReset.actionDescription', lang, **data)}
                </p>
            </div>

            <p style="font-size: 14px; color: #666;">{self.get_text('email.twoFactorReset.instruction', lang, **data)}</p>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    {self.get_text('email.twoFactorReset.warning', lang, **data)}
                </p>
            </div>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                {self.get_text('email.twoFactorReset.footer', lang, **data).replace(chr(10), '<br>')}
            </p>
        """

        html_content = self._get_email_template(
            "background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)",
            title,
            body_content
        )

        text_content = f"{title}\n\n{self.get_text('email.twoFactorReset.greeting', lang, **data)}\n\n{self.get_text('email.twoFactorReset.intro', lang, **data)}\n\n{self.get_text('email.twoFactorReset.actionDescription', lang, **data)}\n\n{self.get_text('email.twoFactorReset.instruction', lang, **data)}\n\n{self.get_text('email.twoFactorReset.warning', lang, **data)}"

        return self.send_email(to_email, subject, html_content, text_content)

    def send_account_deletion_email(self, to_email: str, username: str, verification_code: str, lang: str = 'en') -> Dict[str, Any]:
        """Send account deletion verification code."""
        data = {
            'username': username,
            'minutes': 10
        }
        
        subject = self.get_text('email.deleteAccount.subject', lang, **data)
        title = self.get_text('email.deleteAccount.title', lang, **data)
        
        body_content = f"""
            <p style="font-size: 16px;">{self.get_text('email.deleteAccount.greeting', lang, **data)}</p>

            <p style="font-size: 16px;">{self.get_text('email.deleteAccount.intro', lang, **data)}</p>

            <div style="background: white; border: 2px solid #d32f2f; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                <p style="margin: 0; color: #666; font-size: 14px;">{self.get_text('email.deleteAccount.codeLabel', lang, **data)}</p>
                <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #d32f2f; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                    {verification_code}
                </p>
            </div>

            <p style="font-size: 14px; color: #666;">{self.get_text('email.deleteAccount.expiry', lang, **data)}</p>

            <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                    {self.get_text('email.deleteAccount.warning', lang, **data)}
                </p>
            </div>

            <p style="font-size: 14px; color: #666;">{self.get_text('email.deleteAccount.ignore', lang, **data)}</p>

            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

            <p style="font-size: 12px; color: #999; text-align: center;">
                {self.get_text('email.deleteAccount.footer', lang, **data).replace(chr(10), '<br>')}
            </p>
        """
        
        html_content = self._get_email_template(
            "background: linear-gradient(135deg, #d32f2f 0%, #ef5350 100%)",
            title,
            body_content
        )

        text_content = f"{title}\n\n{self.get_text('email.deleteAccount.greeting', lang, **data)}\n\n{self.get_text('email.deleteAccount.intro', lang, **data)}\n\n{verification_code}\n\n{self.get_text('email.deleteAccount.expiry', lang, **data)}\n\n{self.get_text('email.deleteAccount.warning', lang, **data)}\n\n{self.get_text('email.deleteAccount.ignore', lang, **data)}"

        return self.send_email(to_email, subject, html_content, text_content)
