# Security & Key Management

## TOTP Encryption Key Storage

### Is it secure to store the key in an Azure Environment Variable?
**Yes.** This is the standard, recommended approach for cloud applications (Azure App Service, AWS Lambda, Heroku, etc.).

1.  **Encryption at Rest:** Azure App Service Application Settings are encrypted when stored in Azure's infrastructure. They are only decrypted and injected into the application process memory at runtime.
2.  **Separation of Concerns:** The key is not stored in the source code (git), protecting it from repository leaks.
3.  **Access Control:** Only users with "Contributor" or higher access to the Azure Resource can view these settings.

### How it works
The application determines the encryption key using the following priority:

1.  **Environment Variable (`TOTP_ENCRYPTION_KEY`):** (Highest Priority)
    *   This is where you should store the production key.
    *   Example: `TOTP_ENCRYPTION_KEY=your_base64_encoded_fernet_key`
2.  **Local File (`totp_encryption.key`):**
    *   Used for local development or legacy setups.
    *   On Azure, this file is ephemeral (lost on deployment), which is why **Step 1 is critical**.
3.  **Auto-Generation (Fallback):**
    *   If neither is found, the app generates a new random key.
    *   **CRITICAL:** It logs this new key to the console with a warning. You MUST copy this key and add it to your Azure App Service "Application settings" immediately. If the app restarts before you do this, the key will be lost, and all user 2FA tokens will become invalid.

### Passkey Session Persistence
Passkey registration/authentication challenges are temporary session data.
*   **Storage:** These are stored in **Redis** (if configured) for speed, with a fallback to **MongoDB** (`session_backups` collection).
*   **Security:** These challenges are short-lived, random strings used to verify the authenticator. They do not contain sensitive user secrets. Storing them in the database is safe and necessary for persistence across container restarts.

### Rotating the Key
If you need to rotate the encryption key:
1.  This requires a migration script (not currently implemented) to decrypt all user `totp_secret` fields with the old key and re-encrypt them with the new key.
2.  Simply changing the environment variable will lock all users out of their 2FA.
