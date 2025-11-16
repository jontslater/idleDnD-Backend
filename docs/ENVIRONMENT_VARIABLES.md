# Environment Variables

Complete list of environment variables for the backend.

## Required Variables

### Server Configuration
```env
PORT=3001
NODE_ENV=development
```

### Firebase Configuration
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-client-email@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
```

**Note:** Get these from your Firebase service account key JSON file.

### Twitch OAuth (for User Authentication)
```env
TWITCH_CLIENT_ID=your_twitch_client_id
TWITCH_CLIENT_SECRET=your_twitch_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
```

**How to get these:**
1. Go to https://dev.twitch.tv/console/apps
2. Create a new application (or use existing)
3. Set OAuth Redirect URL to `http://localhost:3000/auth/callback` (development) or your production URL
4. Copy the Client ID and generate a Client Secret

### JWT Configuration
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

**Important:** Use a long, random string for production. You can generate one with:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### CORS Configuration
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

Comma-separated list of allowed origins for CORS.

## Optional Variables

### Twitch Extension (for Bits Purchases)
```env
TWITCH_EXTENSION_SECRET=your_extension_secret
```

Only needed if you have a Twitch Extension for Bits purchases. Skip this for now if you're just doing basic authentication.

## Example .env File

Create a `.env` file in the project root with these values:

```env
# Server
PORT=3001
NODE_ENV=development

# Firebase (from serviceAccountKey.json)
FIREBASE_PROJECT_ID=the-never-ending-war
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@the-never-ending-war.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADA...\n-----END PRIVATE KEY-----\n"

# Twitch OAuth
TWITCH_CLIENT_ID=abc123xyz456
TWITCH_CLIENT_SECRET=def789uvw012
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback

# JWT
JWT_SECRET=super-secret-change-this-in-production

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Production Considerations

1. **Never commit `.env` to Git** - it's already in `.gitignore`
2. **Use strong JWT_SECRET** - generate a random 64-byte hex string
3. **Update TWITCH_REDIRECT_URI** - use your production domain
4. **Update ALLOWED_ORIGINS** - use your production domains only
5. **Enable HTTPS** - required for Twitch OAuth in production
6. **Store secrets securely** - use environment variables in your hosting platform
