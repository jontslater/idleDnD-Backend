# Backend Environment Variables

Create a `.env` file in the `E:\IdleDnD-Backend` directory with the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Firebase Configuration
# Option 1: Use serviceAccountKey.json file (recommended for local development)
# Place serviceAccountKey.json in the backend root directory
# Option 2: Use environment variables (recommended for production)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"

# Twitch OAuth (for User Authentication)
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT Configuration
# Generate a secure secret with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# CORS Configuration
# Comma-separated list of allowed origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Optional: Twitch Extension (for Bits Purchases)
# Only needed if you have a Twitch Extension
# TWITCH_EXTENSION_SECRET=your_extension_secret
```

## Notes

- See `docs/ENVIRONMENT_VARIABLES.md` for detailed setup instructions
- The backend will try to use `serviceAccountKey.json` first, then fall back to environment variables
- For production, use environment variables instead of the JSON file for better security



