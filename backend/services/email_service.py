"""Email service using Resend API for sending verification and recovery emails."""
import os
import requests
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending emails via Resend API."""

    def __init__(self):
        """Initialize email service with Resend API key."""
        self.api_key = os.getenv('RESEND_API_KEY')
        self.api_url = 'https://api.resend.com/emails'
        self.from_email = os.getenv('FROM_EMAIL', 'noreply@chathub.com')
        self.app_name = os.getenv('APP_NAME', 'ChatHub')

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

    def send_verification_email(self, to_email: str, username: str, verification_code: str) -> Dict[str, Any]:
        """Send email verification code."""
        subject = f'{self.app_name} - Verify Your Email'

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Welcome to {self.app_name}!</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px;">Hello <strong>{username}</strong>,</p>

                <p style="font-size: 16px;">Thank you for registering! To complete your account setup, please verify your email address using the code below:</p>

                <div style="background: white; border: 2px solid #1976d2; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                    <p style="margin: 0; color: #666; font-size: 14px;">Your Verification Code</p>
                    <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #1976d2; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                        {verification_code}
                    </p>
                </div>

                <p style="font-size: 14px; color: #666;">This code will expire in <strong>15 minutes</strong>.</p>

                <p style="font-size: 14px; color: #666;">If you didn't create an account with {self.app_name}, please ignore this email.</p>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                <p style="font-size: 12px; color: #999; text-align: center;">
                    This is an automated email, please do not reply.<br>
                    &copy; 2025 {self.app_name}. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Welcome to {self.app_name}!

        Hello {username},

        Thank you for registering! To complete your account setup, please verify your email address using the code below:

        Verification Code: {verification_code}

        This code will expire in 15 minutes.

        If you didn't create an account with {self.app_name}, please ignore this email.
        """

        return self.send_email(to_email, subject, html_content, text_content)

    def send_recovery_email(self, to_email: str, username: str, recovery_code: str) -> Dict[str, Any]:
        """Send account recovery email with verification code."""
        subject = f'{self.app_name} - Account Recovery'

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Account Recovery</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Account Recovery</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px;">Hello <strong>{username}</strong>,</p>

                <p style="font-size: 16px;">We received a request to recover your {self.app_name} account. Use the code below to proceed with account recovery:</p>

                <div style="background: white; border: 2px solid #d32f2f; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                    <p style="margin: 0; color: #666; font-size: 14px;">Your Recovery Code</p>
                    <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #d32f2f; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                        {recovery_code}
                    </p>
                </div>

                <p style="font-size: 14px; color: #666;">This code will expire in <strong>15 minutes</strong>.</p>

                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #856404;">
                        <strong>⚠️ Security Notice:</strong> If you didn't request this recovery, please ignore this email and ensure your email account is secure.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                <p style="font-size: 12px; color: #999; text-align: center;">
                    This is an automated email, please do not reply.<br>
                    &copy; 2025 {self.app_name}. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Account Recovery

        Hello {username},

        We received a request to recover your {self.app_name} account. Use the code below to proceed with account recovery:

        Recovery Code: {recovery_code}

        This code will expire in 15 minutes.

        SECURITY NOTICE: If you didn't request this recovery, please ignore this email and ensure your email account is secure.
        """

        return self.send_email(to_email, subject, html_content, text_content)

    def send_2fa_reset_notification(self, to_email: str, username: str) -> Dict[str, Any]:
        """Send notification that 2FA has been reset."""
        subject = f'{self.app_name} - Two-Factor Authentication Reset'

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>2FA Reset Notification</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #1976d2 0%, #42a5f5 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                <h1 style="color: white; margin: 0;">Security Alert</h1>
            </div>

            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px;">Hello <strong>{username}</strong>,</p>

                <p style="font-size: 16px;">Your two-factor authentication (2FA) has been successfully reset.</p>

                <div style="background: #e3f2fd; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #1565c0;">
                        <strong>✓ What was done:</strong> Your authenticator app has been disconnected and new backup codes have been generated.
                    </p>
                </div>

                <p style="font-size: 14px; color: #666;">Please set up your authenticator app again with the new QR code provided and save your new backup codes in a secure location.</p>

                <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px; color: #856404;">
                        <strong>⚠️ Security Notice:</strong> If you didn't perform this action, someone may have access to your account. Please contact support immediately.
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">

                <p style="font-size: 12px; color: #999; text-align: center;">
                    This is an automated email, please do not reply.<br>
                    &copy; 2025 {self.app_name}. All rights reserved.
                </p>
            </div>
        </body>
        </html>
        """

        text_content = f"""
        Security Alert

        Hello {username},

        Your two-factor authentication (2FA) has been successfully reset.

        What was done: Your authenticator app has been disconnected and new backup codes have been generated.

        Please set up your authenticator app again with the new QR code provided and save your new backup codes in a secure location.

        SECURITY NOTICE: If you didn't perform this action, someone may have access to your account. Please contact support immediately.
        """

        return self.send_email(to_email, subject, html_content, text_content)
