from flask import Blueprint, request, jsonify, session, current_app
from services.auth_service import AuthService
from services.recovery_service import RecoveryService
from utils.validators import (
    validate_username, validate_email, validate_password_strength,
    validate_totp_code, validate_backup_code, validate_security_question_answer
)
from utils.decorators import rate_limit, require_json
import logging

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/register', methods=['POST'])
@require_json
@rate_limit('5/minute')
def register():
    """Register a new user with TOTP setup."""
    try:
        # Get client IP for security
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))

        data = request.get_json()
        username = str(data.get('username', '')).strip()
        email = str(data.get('email', '')).strip()
        password = str(data.get('password', ''))
        phone = str(data.get('phone', '')).strip()
        security_questions = data.get('security_questions', [])

        # Validate input
        validation_errors = []

        if not validate_username(username):
            validation_errors.append('Invalid username format')

        if not validate_email(email):
            validation_errors.append('Invalid email format')

        password_validation = validate_password_strength(password)
        if not password_validation['valid']:
            validation_errors.extend(password_validation['errors'])

        # Validate security questions
        if security_questions:
            valid_questions = []
            for i, question in enumerate(security_questions):
                if not question.get('question') or not question.get('answer'):
                    validation_errors.append(f'Question {i+1} is incomplete')
                    continue

                if not validate_security_question_answer(question['answer']):
                    validation_errors.append(f'Invalid answer for question {i+1}')
                    continue

                valid_questions.append({
                    'question': question['question'],
                    'answer': question['answer']
                })

            security_questions = valid_questions

        if validation_errors:
            return jsonify({'success': False, 'errors': validation_errors}), 400

        # Initialize auth service
        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Register user
        result = auth_service.register_user(
            username=username,
            email=email,
            password=password,
            phone=phone if phone else None,
            security_questions=security_questions,
            lang=data.get('language', 'en')
        )

        if result['success']:
            # Track IP address on registration
            if ip_address:
                from models.user import User
                user_model = User(current_app.db)
                user_model.add_ip_address(result['user_id'], ip_address)

            return jsonify({
                'success': True,
                'message': 'User registered successfully',
                'user_id': result['user_id'],
                'totp_qr_data': result['totp_qr_data'],
                'backup_codes': result['backup_codes']
            }), 201
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Registration failed. Please try again.']}), 500


@auth_bp.route('/verify-totp', methods=['POST'])
@require_json
@rate_limit('10/minute')
def verify_totp():
    """Verify TOTP setup and enable 2FA."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        totp_code = data.get('totp_code', '')

        if not user_id or not validate_totp_code(totp_code):
            return jsonify({'success': False, 'errors': ['Invalid user ID or TOTP code']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.verify_totp_setup(user_id, totp_code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"TOTP verification error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Verification failed. Please try again.']}), 500


@auth_bp.route('/login', methods=['POST'])
@require_json
@rate_limit('5/minute')
def login():
    """Login user with username, password, and TOTP."""
    try:
        data = request.get_json()
        username = str(data.get('username', '')).strip()
        password = str(data.get('password', ''))
        totp_code = str(data.get('totp_code', ''))

        if not username or not password or not validate_totp_code(totp_code):
            return jsonify({'success': False, 'errors': ['Username, password, and TOTP code are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Get client IP for security
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))

        result = auth_service.login_user(username, password, totp_code, ip_address)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Login failed. Please try again.']}), 500


@auth_bp.route('/login-backup', methods=['POST'])
@require_json
@rate_limit('5/minute')
def login_backup():
    """Login using backup code."""
    try:
        data = request.get_json()
        username = str(data.get('username', '')).strip()
        password = str(data.get('password', ''))
        backup_code = str(data.get('backup_code', ''))

        if not username or not password or not validate_backup_code(backup_code):
            return jsonify({'success': False, 'errors': ['Username, password, and backup code are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Get client IP for security
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))

        result = auth_service.login_with_backup_code(username, password, backup_code, ip_address)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Backup login error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Login failed. Please try again.']}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """Logout user and clear session."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.logout_user()
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Logout failed.']}), 500


@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Get currently authenticated user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.get_current_user()
        if result['success']:
            return jsonify(result), 200
        else:
            # Return 200 with success=False instead of 401 to avoid console errors/logs
            # for "check session" calls (standard pattern for single-page apps)
            return jsonify(result), 200

    except Exception as e:
        logger.error(f"Get current user error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get user info.']}), 500


@auth_bp.route('/backup-codes', methods=['POST'])
@require_json
def regenerate_backup_codes():
    """Regenerate backup codes for authenticated user."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Check if user is authenticated
        current_user_result = auth_service.get_current_user()
        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        data = request.get_json() or {}
        totp_code = data.get('totp_code')

        user_id = current_user_result['user']['id']
        result = auth_service.regenerate_backup_codes(user_id, totp_code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Backup codes regeneration error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to regenerate backup codes.']}), 500


@auth_bp.route('/change-password', methods=['POST'])
@require_json
def change_password():
    """Change user password."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Check if user is authenticated
        current_user_result = auth_service.get_current_user()
        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        data = request.get_json()
        current_password = data.get('current_password', '')
        new_password = data.get('new_password', '')

        user_id = current_user_result['user']['id']
        result = auth_service.change_password(user_id, current_password, new_password)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Password change error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to change password.']}), 500


@auth_bp.route('/preferences', methods=['PUT'])
@require_json
def update_preferences():
    """Update user preferences."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Check if user is authenticated
        current_user_result = auth_service.get_current_user()
        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        data = request.get_json()
        preferences = data.get('preferences', {})

        user_id = current_user_result['user']['id']
        result = auth_service.update_preferences(user_id, preferences)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Preferences update error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to update preferences.']}), 500


@auth_bp.route('/recovery/initiate', methods=['POST'])
@require_json
@rate_limit('3/minute')
def initiate_recovery():
    """Initiate account recovery process."""
    try:
        data = request.get_json()
        username = data.get('username', '').strip()
        method = data.get('method', 'sms')  # 'sms' or 'security_questions'

        if not username:
            return jsonify({'success': False, 'errors': ['Username is required']}), 400

        if method not in ['sms', 'security_questions']:
            return jsonify({'success': False, 'errors': ['Invalid recovery method']}), 400

        from flask import current_app
        recovery_service = RecoveryService(current_app.db)

        result = recovery_service.initiate_recovery(username, method)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Recovery initiation error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Recovery initiation failed.']}), 500


@auth_bp.route('/recovery/verify-sms', methods=['POST'])
@require_json
@rate_limit('5/minute')
def verify_recovery_sms():
    """Verify SMS code for account recovery."""
    try:
        data = request.get_json()
        reset_token = data.get('reset_token', '')
        verification_code = data.get('verification_code', '')

        if not reset_token or not verification_code:
            return jsonify({'success': False, 'errors': ['Reset token and verification code are required']}), 400

        from flask import current_app
        recovery_service = RecoveryService(current_app.db)

        result = recovery_service.verify_recovery_sms(reset_token, verification_code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"SMS verification error: {str(e)}")
        return jsonify({'success': False, 'errors': ['SMS verification failed.']}), 500


@auth_bp.route('/recovery/verify-questions', methods=['POST'])
@require_json
@rate_limit('5/minute')
def verify_security_questions():
    """Verify security question answers for account recovery."""
    try:
        data = request.get_json()
        reset_token = data.get('reset_token', '')
        answers = data.get('answers', [])

        if not reset_token or not answers:
            return jsonify({'success': False, 'errors': ['Reset token and answers are required']}), 400

        from flask import current_app
        recovery_service = RecoveryService(current_app.db)

        result = recovery_service.verify_security_questions(reset_token, answers)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Security questions verification error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Security questions verification failed.']}), 500


@auth_bp.route('/recovery/confirm-totp', methods=['POST'])
@require_json
@rate_limit('5/minute')
def confirm_totp_reset():
    """Confirm new TOTP setup after recovery."""
    try:
        data = request.get_json()
        user_id = data.get('user_id', '')
        totp_code = data.get('totp_code', '')

        if not user_id or not validate_totp_code(totp_code):
            return jsonify({'success': False, 'errors': ['User ID and TOTP code are required']}), 400

        from flask import current_app
        recovery_service = RecoveryService(current_app.db)

        result = recovery_service.confirm_totp_reset(user_id, totp_code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"TOTP reset confirmation error: {str(e)}")
        return jsonify({'success': False, 'errors': ['TOTP reset confirmation failed.']}), 500


@auth_bp.route('/session', methods=['GET'])
def get_session_info():
    """Get current session information."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.get_session_info()
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Session info error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to get session info.']}), 500


# Passwordless Authentication Endpoints
@auth_bp.route('/register-passwordless', methods=['POST'])
@require_json
@rate_limit('5/minute')
def register_passwordless():
    """Register a new user without password (only username and email)."""
    try:
        # Get client IP for security
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))

        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        language = data.get('language', 'en')

        if not username or not email:
            return jsonify({'success': False, 'errors': ['Username and email are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.register_user_passwordless(username, email, language)

        if result['success']:
            # Track IP address on registration
            if ip_address:
                from models.user import User
                user_model = User(current_app.db)
                user_model.add_ip_address(result['user_id'], ip_address)

            return jsonify(result), 201
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Passwordless registration error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Registration failed. Please try again.']}), 500


@auth_bp.route('/verify-email', methods=['POST'])
@require_json
@rate_limit('10/minute')
def verify_email():
    """Verify email with verification code."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        code = data.get('code', '')

        if not code:
            return jsonify({'success': False, 'error': 'Verification code is required'}), 400

        if not user_id and not email:
            return jsonify({'success': False, 'error': 'User ID or email is required'}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # If email is provided, get user_id from email
        if email and not user_id:
            from models.user import User
            user_model = User(current_app.db)
            user = user_model.get_user_by_email(email)
            if not user:
                return jsonify({'success': False, 'error': 'User not found'}), 404
            user_id = str(user['_id'])

        result = auth_service.verify_email(user_id, code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Email verification error: {str(e)}")
        return jsonify({'success': False, 'error': 'Verification failed. Please try again.'}), 500


@auth_bp.route('/resend-verification', methods=['POST'])
@require_json
@rate_limit('3/minute')
def resend_verification():
    """Resend email verification code."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        language = data.get('language', 'en')

        if not user_id and not email:
            return jsonify({'success': False, 'error': 'User ID or email is required'}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # If email is provided, get user_id from email
        if email and not user_id:
            from models.user import User
            user_model = User(current_app.db)
            user = user_model.get_user_by_email(email)
            if not user:
                return jsonify({'success': False, 'error': 'User not found'}), 404
            user_id = str(user['_id'])

        result = auth_service.resend_verification_code(user_id, language)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Resend verification error: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to resend code. Please try again.'}), 500


@auth_bp.route('/complete-totp-setup', methods=['POST'])
@require_json
@rate_limit('10/minute')
def complete_totp_setup():
    """Complete TOTP setup and enable 2FA after scanning QR code."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')
        totp_code = data.get('totp_code', '')

        if not totp_code:
            return jsonify({'success': False, 'error': 'TOTP code is required'}), 400

        if not user_id and not email:
            return jsonify({'success': False, 'error': 'User ID or email is required'}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # If email is provided, get user_id from email
        if email and not user_id:
            from models.user import User
            user_model = User(current_app.db)
            user = user_model.get_user_by_email(email)
            if not user:
                return jsonify({'success': False, 'error': 'User not found'}), 404
            user_id = str(user['_id'])

        result = auth_service.complete_totp_setup(user_id, totp_code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"TOTP setup completion error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Setup failed. Please try again.']}), 500


@auth_bp.route('/login-passwordless', methods=['POST'])
@require_json
@rate_limit('5/minute')
def login_passwordless():
    """Login with username/email and TOTP code only (no password)."""
    try:
        data = request.get_json()
        identifier = data.get('identifier', '').strip()  # username or email
        totp_code = data.get('totp_code', '')

        if not identifier or not totp_code:
            return jsonify({'success': False, 'errors': ['Username/email and authentication code are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Get client IP for security
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))

        result = auth_service.login_passwordless(identifier, totp_code, ip_address)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Passwordless login error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Login failed. Please try again.']}), 500


@auth_bp.route('/login-passwordless-backup', methods=['POST'])
@require_json
@rate_limit('5/minute')
def login_passwordless_backup():
    """Login with username/email and backup code only (no password)."""
    try:
        data = request.get_json()
        identifier = data.get('identifier', '').strip()  # username or email
        backup_code = data.get('backup_code', '')

        if not identifier or not backup_code:
            return jsonify({'success': False, 'errors': ['Username/email and backup code are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Get client IP for security
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))

        result = auth_service.login_passwordless_backup_code(identifier, backup_code, ip_address)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Backup code login error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Login failed. Please try again.']}), 500


# Account Recovery Endpoints
@auth_bp.route('/recovery/initiate-passwordless', methods=['POST'])
@require_json
@rate_limit('3/minute')
def initiate_recovery_passwordless():
    """Initiate account recovery by sending code to email."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        language = data.get('language', 'en')

        if not email:
            return jsonify({'success': False, 'errors': ['Email is required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.initiate_recovery_passwordless(email, language)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Recovery initiation error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Recovery initiation failed.']}), 500


@auth_bp.route('/recovery/verify-email-code', methods=['POST'])
@require_json
@rate_limit('5/minute')
def verify_recovery_email():
    """Verify recovery email code."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        code = data.get('code', '')

        if not email or not code:
            return jsonify({'success': False, 'errors': ['Email and code are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.verify_recovery_code(email, code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Recovery email verification error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Verification failed.']}), 500


@auth_bp.route('/recovery/reset-totp', methods=['POST'])
@require_json
@rate_limit('3/minute')
def reset_totp_with_secret():
    """Reset TOTP using original secret from setup."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        original_secret = data.get('original_secret', '').strip()

        if not user_id or not original_secret:
            return jsonify({'success': False, 'errors': ['User ID and original secret are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.reset_totp_with_original_secret(user_id, original_secret)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"TOTP reset error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Reset failed.']}), 500


@auth_bp.route('/recovery/complete-totp-setup', methods=['POST'])
@require_json
@rate_limit('10/minute')
def complete_recovery_totp():
    """Complete TOTP setup after recovery."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        totp_code = data.get('totp_code', '')
        new_secret = data.get('new_secret', '')

        if not user_id or not totp_code or not new_secret:
            return jsonify({'success': False, 'errors': ['User ID, TOTP code, and new secret are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.complete_recovery_totp_setup(user_id, totp_code, new_secret)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Recovery TOTP completion error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Completion failed.']}), 500


# User Recovery Code Endpoints
@auth_bp.route('/recovery-code/set', methods=['POST'])
@require_json
@rate_limit('3/minute')
def set_recovery_code():
    """Set user-defined recovery code (like a master password)."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        data = request.get_json()
        recovery_code = data.get('recovery_code', '')
        user_id = data.get('user_id')
        email = data.get('email')

        if not recovery_code:
            return jsonify({'success': False, 'error': 'Recovery code is required'}), 400

        # Try to get authenticated user first
        current_user_result = auth_service.get_current_user()
        if current_user_result['success']:
            user_id = current_user_result['user']['id']
        else:
            # If not authenticated, check if email or user_id is provided (for registration flow)
            if not user_id and not email:
                return jsonify({'success': False, 'error': 'Authentication required or user identifier needed'}), 401

            # If email is provided, get user_id from email
            if email and not user_id:
                from models.user import User
                user_model = User(current_app.db)
                user = user_model.get_user_by_email(email)
                if not user:
                    return jsonify({'success': False, 'error': 'User not found'}), 404
                user_id = str(user['_id'])

        result = auth_service.set_user_recovery_code(user_id, recovery_code)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Set recovery code error: {str(e)}")
        return jsonify({'success': False, 'error': 'Failed to set recovery code'}), 500


@auth_bp.route('/recovery/verify-user-code', methods=['POST'])
@require_json
@rate_limit('5/minute')
def verify_user_recovery_code():
    """Verify user-defined recovery code and reset 2FA."""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        recovery_code = data.get('recovery_code', '')
        language = data.get('language', 'en')

        if not email or not recovery_code:
            return jsonify({'success': False, 'errors': ['Email and recovery code are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.verify_user_recovery_code_for_reset(email, recovery_code, language)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"User recovery code verification error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Verification failed']}), 500


# Passkey/WebAuthn Endpoints
# Passkey/WebAuthn Endpoints
@auth_bp.route('/passkey/register-options', methods=['POST'])
@require_json
def passkey_register_options():
    """Generate passkey registration options."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)
        
        data = request.get_json() or {}
        user_id = data.get('user_id')
        email = data.get('email')

        # Check if user is authenticated
        current_user_result = auth_service.get_current_user()
        if current_user_result['success']:
             user_id = current_user_result['user']['id']
        else:
            # If not authenticated, check if email/user_id is provided in body (for registration flow)
            if not user_id and not email:
                 return jsonify({'success': False, 'errors': ['Authentication required']}), 401
            
            # If email provided, look up user
            if email and not user_id:
                from models.user import User
                user_model = User(current_app.db)
                user = user_model.get_user_by_email(email)
                if not user:
                    return jsonify({'success': False, 'errors': ['User not found']}), 404
                user_id = str(user['_id'])

        result = auth_service.generate_passkey_registration_options(user_id)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Passkey registration options error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to generate passkey options']}), 500


@auth_bp.route('/passkey/register-verify', methods=['POST'])
@require_json
def passkey_register_verify():
    """Verify passkey registration."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        data = request.get_json()
        credential = data.get('credential')
        user_id = data.get('user_id')
        email = data.get('email')

        if not credential:
            return jsonify({'success': False, 'errors': ['Credential data is required']}), 400

        # Check if user is authenticated
        current_user_result = auth_service.get_current_user()
        if current_user_result['success']:
             user_id = current_user_result['user']['id']
        else:
             # Fallback for registration flow
             if not user_id and not email:
                 return jsonify({'success': False, 'errors': ['Authentication required']}), 401
             
             if email and not user_id:
                from models.user import User
                user_model = User(current_app.db)
                user = user_model.get_user_by_email(email)
                if not user:
                    return jsonify({'success': False, 'errors': ['User not found']}), 404
                user_id = str(user['_id'])

        result = auth_service.verify_passkey_registration(user_id, credential)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Passkey registration verification error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Registration verification failed']}), 500


@auth_bp.route('/passkey/auth-options', methods=['POST'])
@require_json
@rate_limit('10/minute')
def passkey_auth_options():
    """Generate passkey authentication options."""
    try:
        data = request.get_json()
        identifier = data.get('identifier', '').strip()  # Optional username/email

        from flask import current_app
        auth_service = AuthService(current_app.db)

        result = auth_service.generate_passkey_authentication_options(identifier if identifier else None)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Passkey auth options error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to generate auth options']}), 500


@auth_bp.route('/passkey/auth-verify', methods=['POST'])
@require_json
@rate_limit('5/minute')
def passkey_auth_verify():
    """Verify passkey authentication (login)."""
    try:
        data = request.get_json()
        credential = data.get('credential')
        identifier = data.get('identifier', '').strip()  # Username/email

        if not credential or not identifier:
            return jsonify({'success': False, 'errors': ['Credential and identifier are required']}), 400

        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Get client IP for security
        ip_address = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR'))

        result = auth_service.verify_passkey_authentication(credential, identifier)

        if result['success']:
            # Log IP address
            from models.user import User
            user_model = User(current_app.db)
            if ip_address:
                user_model.add_ip_address(result['user']['id'], ip_address)

            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Passkey auth verification error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Authentication failed']}), 500


@auth_bp.route('/passkey/list', methods=['GET'])
def passkey_list():
    """List user's registered passkeys."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Check if user is authenticated
        current_user_result = auth_service.get_current_user()
        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        user_id = current_user_result['user']['id']
        result = auth_service.get_user_passkeys(user_id)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Passkey list error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to retrieve passkeys']}), 500


@auth_bp.route('/passkey/<credential_id>', methods=['DELETE'])
def passkey_delete(credential_id):
    """Delete a passkey."""
    try:
        from flask import current_app
        auth_service = AuthService(current_app.db)

        # Check if user is authenticated
        current_user_result = auth_service.get_current_user()
        if not current_user_result['success']:
            return jsonify({'success': False, 'errors': ['Authentication required']}), 401

        user_id = current_user_result['user']['id']
        result = auth_service.remove_passkey(user_id, credential_id)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Passkey delete error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to delete passkey']}), 500


# QR Code Generation Endpoint
@auth_bp.route('/totp/qrcode', methods=['POST'])
@require_json
def get_totp_qrcode():
    """Generate QR code image for TOTP setup."""
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        email = data.get('email')

        from flask import current_app
        auth_service = AuthService(current_app.db)
        
        result = auth_service.generate_totp_qr_image_url(user_id, email)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"QR code generation endpoint error: {str(e)}")
        return jsonify({'success': False, 'errors': ['Failed to generate QR code']}), 500
