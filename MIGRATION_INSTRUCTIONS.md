# Migration Instructions - TopicsFlow

## Overview

This document explains how to migrate your existing ChatHub data to the new TopicsFlow structure, which converts Topics to Themes and creates Posts from old messages.

## What the Migration Does

The migration script (`scripts/migrate_to_themes.py`) performs the following:

1. **Converts Topics to Themes**: All existing Topics are converted to Themes with the same data
2. **Creates Posts**: The first message in each topic becomes a Post
3. **Creates Comments**: Remaining messages become Comments on the Post
4. **Creates Chat Rooms**: A default chat room is created for each migrated theme
5. **Preserves Data**: All original Topics and Messages are kept for backward compatibility

## Important Notes

- ✅ **Safe**: Original data is NOT deleted - Topics and Messages remain in the database
- ✅ **Reversible**: You can keep using the old `/api/topics` endpoints if needed
- ✅ **Non-destructive**: The migration only creates new data, it doesn't modify existing data

## Prerequisites

1. **Backup your database** (recommended):
   ```bash
   mongodump --uri="mongodb://localhost:27017/chatapp" --out=./backup
   ```

2. **Ensure environment variables are set**:
   - `DATABASE_URL` or `MONGODB_URI` - MongoDB connection string
   - `DB_NAME` or `MONGODB_DB_NAME` - Database name

3. **Python dependencies**:
   ```bash
   pip install pymongo python-dotenv
   ```

## Running the Migration

### Option 1: Direct Python Execution

```bash
# From project root
cd scripts
python migrate_to_themes.py
```

### Option 2: Using Python Module

```bash
# From project root
python -m scripts.migrate_to_themes
```

### Option 3: With Virtual Environment

```bash
# Activate your virtual environment first
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

# Then run the script
python scripts/migrate_to_themes.py
```

## What to Expect

The script will:

1. **Prompt for confirmation**: Type `yes` or `y` to proceed
2. **Show progress**: Displays each topic being migrated
3. **Report results**: Shows counts of themes, posts, and chat rooms created

Example output:
```
============================================================
TopicsFlow Migration Script
Converting Topics to Themes
============================================================

This will create new Themes, Posts, Comments, and Chat Rooms.
Original Topics and Messages will be preserved.
Continue? (yes/no): yes

Starting migration: Topics -> Themes
Found 5 topics to migrate
  Created theme: Technology Discussion (ID: 507f1f77bcf86cd799439011)
    Created post from first message (ID: 507f191e810c19729de860ea)
      Created comment 1 from message
      Created comment 2 from message
    Created default chat room (ID: 507f1f77bcf86cd799439012)
  ...

Migration complete!
  Themes created: 5
  Posts created: 5
  Chat rooms created: 5

Note: Original topics and messages are preserved for backward compatibility.
```

## After Migration

### 1. Verify the Migration

Check that themes were created:
```bash
# Using MongoDB shell
mongo chatapp
> db.themes.find().count()
> db.posts.find().count()
> db.chat_rooms.find().count()
```

### 2. Test the Application

1. Start the backend:
   ```bash
   cd backend
   python app.py
   ```

2. Start the frontend:
   ```bash
   cd frontend
   npm run dev
   ```

3. Test the new features:
   - Navigate to `/` - should show Themes instead of Topics
   - Click on a Theme - should show Posts and Chat Rooms tabs
   - Create a new Post - should appear in the Posts tab
   - Create a new Comment - should appear under the Post
   - Join a Chat Room - should allow messaging

### 3. Update Your Code (Optional)

If you have custom code that uses the old Topics API, you can:
- Continue using `/api/topics` (still works for backward compatibility)
- Gradually migrate to `/api/themes` endpoints
- Remove old Topics code when ready

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'config'"

**Solution**: The script now uses environment variables directly. Make sure your `.env` file is in the `backend/` directory or project root.

### Error: "Connection refused"

**Solution**: 
1. Ensure MongoDB is running: `mongod` or `docker-compose up mongodb`
2. Check your `DATABASE_URL` in `.env` file
3. Verify MongoDB is accessible: `mongosh mongodb://localhost:27017`

### Error: "Database not found"

**Solution**: The database will be created automatically. If it doesn't exist, create it first:
```bash
mongosh mongodb://localhost:27017
> use chatapp
```

### Migration Runs but No Data Created

**Check**:
1. Are there any Topics in the database? Run: `db.topics.find().count()`
2. Check the script output for error messages
3. Verify you have write permissions to the database

## Rollback (If Needed)

Since the migration doesn't delete original data, you can:

1. **Stop using Themes**: Continue using `/api/topics` endpoints
2. **Delete migrated data** (if needed):
   ```javascript
   // In MongoDB shell
   db.themes.deleteMany({})
   db.posts.deleteMany({})
   db.comments.deleteMany({})
   db.chat_rooms.deleteMany({})
   ```
3. **Restore from backup**:
   ```bash
   mongorestore --uri="mongodb://localhost:27017/chatapp" ./backup
   ```

## Next Steps

After successful migration:

1. ✅ Test all new features (Themes, Posts, Comments, Chat Rooms)
2. ✅ Update any custom integrations to use new endpoints
3. ✅ Monitor application performance
4. ✅ Consider removing old Topics code in a future update

## Support

If you encounter issues:

1. Check the script output for error messages
2. Verify your MongoDB connection
3. Ensure all environment variables are set correctly
4. Review the migration script logs

---

**Note**: This migration is designed to be safe and non-destructive. Your original data remains intact, and you can continue using the old Topics API if needed.


