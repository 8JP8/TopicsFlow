"""Passkey/WebAuthn service for biometric and security key authentication."""
import os
import base64
from typing import Dict, Any, Optional
from webauthn import (
    generate_registration_options,
    verify_registration_response,
    generate_authentication_options,
    verify_authentication_response,
    options_to_json
)
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    UserVerificationRequirement,
    AttestationConveyancePreference,
    AuthenticatorAttachment,
    ResidentKeyRequirement,
    PublicKeyCredentialDescriptor
)
from webauthn.helpers.cose import COSEAlgorithmIdentifier
import logging

logger = logging.getLogger(__name__)


class PasskeyService:
    """Service for managing WebAuthn/Passkey authentication."""

    def __init__(self, rp_id: str = None, rp_name: str = "TopicsFlow"):
        """
        Initialize passkey service.

        Args:
            rp_id: Relying Party ID (your domain, e.g., 'localhost' or 'topicsflow.com')
            rp_name: Relying Party name (your app name)
        """
        # Use environment variable or default
        self.rp_id = rp_id or os.getenv('PASSKEY_RP_ID', 'localhost')
        self.rp_name = rp_name or os.getenv('APP_NAME', 'TopicsFlow')

        # Origin for WebAuthn (e.g., 'http://localhost:3000' or 'https://topicsflow.com')
        self.origin = os.getenv('FRONTEND_URL', 'http://localhost:3000')

        logger.info(f"PasskeyService initialized: RP ID={self.rp_id}, Origin={self.origin}")

    def generate_registration_options(self, user_id: str, username: str, display_name: str = None) -> Dict[str, Any]:
        """
        Generate options for passkey registration.

        Args:
            user_id: User's unique ID
            username: User's username
            display_name: User's display name (optional, defaults to username)

        Returns:
            Registration options to send to client
        """
        try:
            # Convert user_id to bytes (required by WebAuthn)
            user_id_bytes = user_id.encode('utf-8')

            # Generate registration options
            options = generate_registration_options(
                rp_id=self.rp_id,
                rp_name=self.rp_name,
                user_id=user_id_bytes,
                user_name=username,
                user_display_name=display_name or username,
                attestation=AttestationConveyancePreference.NONE,  # No attestation required
                authenticator_selection=AuthenticatorSelectionCriteria(
                    authenticator_attachment=AuthenticatorAttachment.PLATFORM,  # Platform authenticator (e.g., Face ID, Windows Hello)
                    resident_key=ResidentKeyRequirement.PREFERRED,  # Store credentials on device
                    user_verification=UserVerificationRequirement.PREFERRED  # Biometric/PIN verification
                ),
                supported_pub_key_algs=[
                    COSEAlgorithmIdentifier.ECDSA_SHA_256,
                    COSEAlgorithmIdentifier.RSASSA_PKCS1_v1_5_SHA_256,
                ],
                timeout=60000  # 60 seconds
            )

            # Convert to JSON-serializable format
            options_json = options_to_json(options)

            # Store challenge in session or return it (client needs to send it back)
            return {
                'success': True,
                'options': options_json,
                'challenge': base64.urlsafe_b64encode(options.challenge).decode('utf-8')
            }

        except Exception as e:
            logger.error(f"Failed to generate registration options: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to generate passkey registration options'
            }

    def verify_registration(self, credential: Dict[str, Any], expected_challenge: bytes) -> Optional[Dict[str, Any]]:
        """
        Verify passkey registration response.

        Args:
            credential: Registration credential from client
            expected_challenge: Challenge that was sent to client

        Returns:
            Verified credential data or None if verification failed
        """
        try:
            # Verify the registration response
            verification = verify_registration_response(
                credential=credential,
                expected_challenge=expected_challenge,
                expected_origin=self.origin,
                expected_rp_id=self.rp_id
            )

            # Store credential data for future authentication
            credential_data = {
                'credential_id': base64.urlsafe_b64encode(verification.credential_id).decode('utf-8'),
                'public_key': base64.urlsafe_b64encode(verification.credential_public_key).decode('utf-8'),
                'sign_count': verification.sign_count,
                'aaguid': str(verification.aaguid) if verification.aaguid else None,
                'created_at': datetime.utcnow().isoformat(),
                'last_used': None,
                'device_name': None  # Can be set by user later
            }

            logger.info(f"Passkey registration verified successfully")
            return credential_data

        except Exception as e:
            logger.error(f"Passkey registration verification failed: {str(e)}")
            return None

    def generate_authentication_options(self, credentials: list = None) -> Dict[str, Any]:
        """
        Generate options for passkey authentication.

        Args:
            credentials: List of allowed credentials (optional, None = allow any)

        Returns:
            Authentication options to send to client
        """
        try:
            # Convert stored credentials to PublicKeyCredentialDescriptor format
            allow_credentials = []
            if credentials:
                for cred in credentials:
                    try:
                        credential_id = base64.urlsafe_b64decode(cred['credential_id'])
                        allow_credentials.append(
                            PublicKeyCredentialDescriptor(id=credential_id)
                        )
                    except Exception as e:
                        logger.warning(f"Failed to parse credential: {str(e)}")
                        continue

            # Generate authentication options
            options = generate_authentication_options(
                rp_id=self.rp_id,
                allow_credentials=allow_credentials if allow_credentials else None,
                user_verification=UserVerificationRequirement.PREFERRED,
                timeout=60000  # 60 seconds
            )

            # Convert to JSON-serializable format
            options_json = options_to_json(options)

            return {
                'success': True,
                'options': options_json,
                'challenge': base64.urlsafe_b64encode(options.challenge).decode('utf-8')
            }

        except Exception as e:
            logger.error(f"Failed to generate authentication options: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to generate passkey authentication options'
            }

    def verify_authentication(
        self,
        credential: Dict[str, Any],
        expected_challenge: bytes,
        stored_credential: Dict[str, Any]
    ) -> Optional[int]:
        """
        Verify passkey authentication response.

        Args:
            credential: Authentication credential from client
            expected_challenge: Challenge that was sent to client
            stored_credential: Stored credential data from database

        Returns:
            New sign count if verification succeeded, None otherwise
        """
        try:
            # Decode stored public key and credential ID
            credential_public_key = base64.urlsafe_b64decode(stored_credential['public_key'])
            credential_id = base64.urlsafe_b64decode(stored_credential['credential_id'])
            current_sign_count = stored_credential['sign_count']

            # Verify the authentication response
            verification = verify_authentication_response(
                credential=credential,
                expected_challenge=expected_challenge,
                expected_origin=self.origin,
                expected_rp_id=self.rp_id,
                credential_public_key=credential_public_key,
                credential_current_sign_count=current_sign_count,
                require_user_verification=True
            )

            logger.info(f"Passkey authentication verified successfully")

            # Return new sign count (should be incremented)
            return verification.new_sign_count

        except Exception as e:
            logger.error(f"Passkey authentication verification failed: {str(e)}")
            return None


# Import datetime at the top (needed for credential_data)
from datetime import datetime
