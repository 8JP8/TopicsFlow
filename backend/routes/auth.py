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
        data = request.get_json()
        username = data.get('username', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        phone = data.get('phone', '').strip()
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
            security_questions=security_questions
        )

        if result['success']:
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
        username = data.get('username', '').strip()
        password = data.get('password', '')
        totp_code = data.get('totp_code', '')

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
        username = data.get('username', '').strip()
        password = data.get('password', '')
        backup_code = data.get('backup_code', '')

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
            return jsonify(result), 401

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

        user_id = current_user_result['user']['id']
        result = auth_service.regenerate_backup_codes(user_id)

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