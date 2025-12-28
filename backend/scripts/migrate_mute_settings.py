import sys
import os
from datetime import datetime
from bson import ObjectId

# Add backend to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app
from models.notification_settings import NotificationSettings

def run_migration():
    app = create_app()
    with app.app_context():
        print("Starting mute settings migration...")
        settings_model = NotificationSettings(app.db)
        count = settings_model.migrate_from_conversation_settings()
        print(f"Migration completed. Migrated {count} settings.")

if __name__ == "__main__":
    run_migration()
