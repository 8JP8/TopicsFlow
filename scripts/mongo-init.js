// MongoDB initialization script for TopicsFlow
// This script runs when MongoDB starts for the first time

// Switch to the TopicsFlow database
db = db.getSiblingDB('TopicsFlow');

// Create collections and indexes
print('Creating collections and indexes...');

// Users collection indexes
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });
db.users.createIndex({ "ip_addresses": 1 });
db.users.createIndex({ "created_at": 1 });

// Topics collection indexes
db.topics.createIndex({ "created_at": 1 });
db.topics.createIndex({ "member_count": -1 });
db.topics.createIndex({ "last_activity": -1 });
db.topics.createIndex({ "tags": 1 });
db.topics.createIndex({ "owner_id": 1 });

// Messages collection indexes
db.messages.createIndex({ "topic_id": 1, "created_at": -1 });
db.messages.createIndex({ "user_id": 1 });
db.messages.createIndex({ "created_at": 1 });
db.messages.createIndex({ "content": "text" });

// Reports collection indexes
db.reports.createIndex({ "topic_id": 1, "status": 1 });
db.reports.createIndex({ "created_at": 1 });
db.reports.createIndex({ "reported_by": 1 });

// Private messages collection indexes
db.private_messages.createIndex({ "from_user_id": 1, "to_user_id": 1 });
db.private_messages.createIndex({ "to_user_id": 1, "created_at": -1 });
db.private_messages.createIndex({ "created_at": 1 });

// Anonymous identities collection indexes
db.anonymous_identities.createIndex({ "user_id": 1, "topic_id": 1 }, { unique: true });
db.anonymous_identities.createIndex({ "topic_id": 1 });
db.anonymous_identities.createIndex({ "created_at": 1 });

// Create a basic admin user (for initial setup - remove in production)
// Only create if no users exist
if (db.users.countDocuments() === 0) {
  print('Creating initial admin user...');
  // Note: In production, you should manually create the first user
  // This is just for demonstration purposes
}

// Create default security questions collection (optional)
if (!db.security_questions.findOne()) {
  db.security_questions.insertMany([
    { question: "What was your first pet's name?", active: true },
    { question: "What city were you born in?", active: true },
    { question: "What is your mother's maiden name?", active: true },
    { question: "What was the name of your elementary school?", active: true },
    { question: "What is your favorite childhood memory?", active: true },
    { question: "What was the make and model of your first car?", active: true },
    { question: "What is your favorite food?", active: true },
    { question: "What is the name of your best childhood friend?", active: true },
    { question: "What street did you grow up on?", active: true },
    { question: "What is the name of your favorite teacher?", active: true }
  ]);
  print('Created default security questions');
}

// Set up validation rules (optional)
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["username", "email", "password_hash", "totp_secret"],
      properties: {
        username: {
          bsonType: "string",
          minLength: 3,
          maxLength: 20,
          pattern: "^[a-zA-Z0-9_-]+$"
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
        },
        password_hash: {
          bsonType: "string"
        },
        totp_secret: {
          bsonType: "string"
        },
        totp_enabled: {
          bsonType: "bool"
        }
      }
    }
  }
});

print('MongoDB initialization completed successfully!');
print('TopicsFlow database is ready for use.');