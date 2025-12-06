from functools import wraps
from flask import jsonify, current_app
from services.auth_service import AuthService
import logging

logger = logging.getLogger(__name__)


def require_admin():
    """Decorator to require admin privileges for a route.

    This decorator should be used after @require_auth() to ensure the user
    is authenticated and has admin privileges.

    Usage:
        @app.route('/admin/users')
        @require_auth()
        @require_admin()
        def admin_users():
            # Admin-only route logic
            pass
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Get current user
                auth_service = AuthService(current_app.db)
                current_user_result = auth_service.get_current_user()

                if not current_user_result.get('success'):
                    return jsonify({
                        'success': False,
                        'errors': ['Authentication required']
                    }), 401

                user = current_user_result.get('user', {})

                # Check if user has admin privileges
                if not user.get('is_admin', False):
                    logger.warning(f"Unauthorized admin access attempt by user: {user.get('id')}")
                    return jsonify({
                        'success': False,
                        'errors': ['Admin privileges required']
                    }), 403

                # User is admin, proceed with the route
                return f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Admin middleware error: {str(e)}")
                return jsonify({
                    'success': False,
                    'errors': ['Authorization check failed']
                }), 500

        return decorated_function
    return decorator


def check_admin_permission(user_id: str, db) -> bool:
    """Check if a user has admin privileges.

    Args:
        user_id: User ID to check
        db: Database instance

    Returns:
        True if user is admin, False otherwise
    """
    from models.user import User

    try:
        user_model = User(db)
        user = user_model.get_user_by_id(user_id)

        if not user:
            return False

        return user.get('is_admin', False)
    except Exception as e:
        logger.error(f"Error checking admin permission: {str(e)}")
        return False


def is_admin_or_moderator(user_id: str, topic_id: str, db) -> bool:
    """Check if user is either a global admin or topic moderator.

    Args:
        user_id: User ID to check
        topic_id: Topic ID to check moderator status for
        db: Database instance

    Returns:
        True if user is admin or moderator, False otherwise
    """
    from models.user import User
    from models.topic import Topic

    try:
        # Check if global admin
        if check_admin_permission(user_id, db):
            return True

        # Check if topic moderator
        topic_model = Topic(db)
        permission_level = topic_model.get_user_permission_level(topic_id, user_id)

        # Permission level >= 2 means moderator or owner
        return permission_level >= 2

    except Exception as e:
        logger.error(f"Error checking admin/moderator status: {str(e)}")
        return False
