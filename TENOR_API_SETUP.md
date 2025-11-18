# Tenor API Setup Guide

## Getting a Tenor API Key

1. Go to https://tenor.com/developer/keyregistration
2. Sign in with your Google account (Tenor is owned by Google)
3. Click "Create New API Key"
4. Fill in the application details:
   - **Application Name**: ChatHub (or your app name)
   - **Application URL**: http://localhost:3000 (for development)
   - **Description**: Chat application with GIF support
5. Accept the terms and conditions
6. Copy your API key

## Setting Up the API Key

### Backend (.env file)

The API key is already configured in the setup scripts. If you need to add it manually, add the following to your `backend/.env` file:

```env
TENOR_API_KEY=AIzaSyCiAjRAFCxxSqkRIgzhZSSaDWktv84ZxW4
```

**Note:** The API key is already included in:
- `setup-env.bat` (Windows)
- `setup-env.sh` (Linux/Mac)
- `setup-env.ps1` (PowerShell)

Just run the appropriate setup script to configure it automatically.

### Current Configuration:

```env
TENOR_API_KEY=AIzaSyCiAjRAFCxxSqkRIgzhZSSaDWktv84ZxW4
```

This key is already configured in the setup scripts and will be automatically added when you run `setup-env.bat`, `setup-env.sh`, or `setup-env.ps1`.

## Verifying the Setup

1. Restart your backend server after adding the API key
2. Try opening the GIF picker in the frontend
3. Check the browser console for any errors
4. Check backend logs for Tenor API calls

## Troubleshooting

### Error: "Tenor API key not configured"
- Make sure `TENOR_API_KEY` is set in your `.env` file
- Restart the backend server after adding the key
- Check that the `.env` file is in the `backend/` directory

### Error: "Failed to load trending GIFs"
- Verify your API key is correct
- Check if you've exceeded rate limits (free tier has limits)
- Check backend logs for detailed error messages

### No GIFs showing
- Check browser console for errors
- Verify the API key is valid
- Try searching for GIFs instead of relying on trending

## Rate Limits

Tenor's free tier has rate limits:
- **Anonymous key (demo)**: Very limited
- **Registered key**: Higher limits, but still rate-limited

For production use, consider:
- Caching GIF results
- Implementing request throttling
- Using a paid Tenor plan if needed

## API Documentation

Full Tenor API documentation: https://tenor.com/gifapi/documentation

