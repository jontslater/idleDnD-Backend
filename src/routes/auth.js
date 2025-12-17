import express from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import { db } from '../index.js';

const router = express.Router();

// JWT secret for generating tokens (should be in .env in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '30d';

/**
 * Middleware to verify JWT token
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Exchange Twitch OAuth code for user data and JWT token
 * POST /api/auth/twitch
 */
router.post('/twitch', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token with Twitch
    const twitchTokenResponse = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TWITCH_REDIRECT_URI || 'http://localhost:3000/auth/callback'
      })
    });

    if (!twitchTokenResponse.ok) {
      const errorData = await twitchTokenResponse.json();
      console.error('Twitch token exchange failed:', errorData);
      return res.status(400).json({ error: 'Failed to authenticate with Twitch' });
    }

    const { access_token, refresh_token } = await twitchTokenResponse.json();

    // Get Twitch user info
    const twitchUserResponse = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID
      }
    });

    if (!twitchUserResponse.ok) {
      console.error('Failed to fetch Twitch user info');
      return res.status(400).json({ error: 'Failed to fetch user information' });
    }

    const twitchData = await twitchUserResponse.json();
    const twitchUser = twitchData.data[0];

    if (!twitchUser) {
      return res.status(400).json({ error: 'No user data received from Twitch' });
    }

    // Find all heroes for this user (update all of them with twitchUsername)
    const heroQuery = await db.collection('heroes')
      .where('twitchUserId', '==', twitchUser.id)
      .get();

    let hero = null;

    if (!heroQuery.empty) {
      // Existing heroes found - update all of them with twitchUsername
      const batch = db.batch();
      const updateData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Store Twitch access token for chat listener (encrypted at rest by Firebase)
      // This allows the backend to listen to the streamer's chat automatically
      if (access_token) {
        updateData.twitchAccessToken = access_token;
        if (refresh_token) {
          updateData.twitchRefreshToken = refresh_token;
        }
        updateData.twitchTokenExpiresAt = Date.now() + (60 * 60 * 1000); // 1 hour from now
        updateData.twitchUsername = twitchUser.login.toLowerCase(); // Store username for lookup
      } else {
        // Even without token, update twitchUsername for Founders Hall display
        updateData.twitchUsername = twitchUser.login.toLowerCase();
      }
      
      // Update all user's heroes with twitchUsername
      heroQuery.docs.forEach(heroDoc => {
        batch.update(heroDoc.ref, updateData);
      });
      
      await batch.commit();
      
      // Use first hero for response (for backward compatibility)
      const firstHeroDoc = heroQuery.docs[0];
      hero = { id: firstHeroDoc.id, ...firstHeroDoc.data() };
      console.log(`Updated ${heroQuery.docs.length} heroes with twitchUsername: ${twitchUser.login.toLowerCase()}`);
    } else {
      // No hero found - user needs to create one in the Electron app
      console.log(`No hero found for Twitch user ${twitchUser.id} (${twitchUser.display_name})`);
      hero = null;
    }
    
    // Always try to initialize chat listener if we have a token
    // This allows streamers to connect to their chat automatically
    const streamerUsername = twitchUser.login.toLowerCase();
    if (access_token) {
      const { initializeStreamerChatListener } = await import('../websocket/twitch-events.js');
      console.log(`🔌 Attempting to initialize chat listener for ${streamerUsername}...`);
      console.log(`   Hero found: ${hero ? 'Yes' : 'No'}`);
      console.log(`   Token available: Yes`);
      
      initializeStreamerChatListener(streamerUsername, access_token, refresh_token)
        .then(client => {
          if (client) {
            console.log(`✅ Chat listener successfully initialized for ${streamerUsername}`);
          } else {
            console.log(`⚠️  Chat listener already active for ${streamerUsername}`);
          }
        })
        .catch(err => {
          console.error(`❌ Failed to initialize chat listener for ${streamerUsername}:`, err);
          console.error(`   Error details:`, err.message || err);
          console.error(`   This might be normal if the OAuth token doesn't have IRC chat scopes.`);
          console.error(`   The token needs 'chat:read' scope to listen to chat.`);
          console.error(`   Streamer can manually initialize via POST /api/chat/initialize`);
        });
    } else {
      console.log(`⚠️  No access token available for ${streamerUsername} - chat listener not initialized`);
    }

    // Generate JWT token
    const jwtPayload = {
      userId: hero ? hero.id : null,
      twitchUserId: twitchUser.id,
      twitchUsername: twitchUser.login,
      displayName: twitchUser.display_name
    };

    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Return user data and token
    res.json({
      user: {
        id: hero ? hero.id : null,
        twitchUsername: twitchUser.display_name,
        twitchId: twitchUser.id,
        hero: hero // Can be null if no hero exists yet
      },
      token
    });
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

/**
 * TikTok OAuth login
 * POST /api/auth/tiktok
 */
router.post('/tiktok', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Exchange code for access token with TikTok
    const tokenResponse = await fetch('https://open-api.tiktok.com/oauth/access_token/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_ID,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('TikTok token exchange failed:', errorData);
      return res.status(400).json({ error: 'Failed to authenticate with TikTok' });
    }

    const tokenData = await tokenResponse.json();
    
    if (tokenData.data?.error_code) {
      console.error('TikTok error:', tokenData);
      return res.status(400).json({ error: tokenData.data.description || 'TikTok authentication failed' });
    }

    const accessToken = tokenData.data.access_token;
    const openId = tokenData.data.open_id;

    // Get TikTok user info
    const userResponse = await fetch(`https://open-api.tiktok.com/user/info/?access_token=${accessToken}&open_id=${openId}&fields=open_id,display_name,avatar_url`);

    if (!userResponse.ok) {
      console.error('Failed to fetch TikTok user info');
      return res.status(400).json({ error: 'Failed to fetch user information' });
    }

    const userData = await userResponse.json();
    
    if (userData.data?.error_code) {
      console.error('TikTok user fetch error:', userData);
      return res.status(400).json({ error: 'Failed to fetch TikTok user data' });
    }

    const tiktokUser = userData.data.user;
    const tiktokUserId = tiktokUser.open_id;
    const displayName = tiktokUser.display_name;

    // Find hero in Firebase
    const heroQuery = await db.collection('heroes')
      .where('tiktokUserId', '==', tiktokUserId)
      .limit(1)
      .get();

    let heroDoc = null;
    let hero = null;

    if (!heroQuery.empty) {
      // Existing hero found
      heroDoc = heroQuery.docs[0];
      
      // Update last login
      await heroDoc.ref.update({
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      hero = { id: heroDoc.id, ...heroDoc.data() };
    } else {
      // No hero found - user needs to create one
      console.log(`No hero found for TikTok user ${tiktokUserId} (${displayName})`);
      hero = null;
    }

    // Generate JWT token
    const jwtPayload = {
      userId: hero ? hero.id : null,
      tiktokUserId: tiktokUserId,
      tiktokUsername: displayName,
      displayName: displayName
    };

    const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // Return user data and token
    res.json({
      user: {
        id: hero ? hero.id : null,
        tiktokUsername: displayName,
        tiktokId: tiktokUserId,
        hero: hero // Can be null if no hero exists yet
      },
      token
    });
  } catch (error) {
    console.error('TikTok authentication error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

/**
 * Get current user (verify token)
 * GET /api/auth/me
 *
 * NOTE: This endpoint should NOT 404 just because the hero document is missing.
 * We return the identity from the JWT and include `hero: null` if no hero doc exists.
 */
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { userId, displayName, twitchUserId, twitchUsername, tiktokUserId, tiktokUsername } = req.user;

    let hero = null;

    if (userId) {
      try {
        const heroDoc = await db.collection('heroes').doc(userId).get();
        if (heroDoc.exists) {
          hero = { id: heroDoc.id, ...heroDoc.data() };
        }
      } catch (err) {
        console.error('Error loading hero for /me:', err);
      }
    }

    // Use twitchUsername from JWT if available, fallback to displayName
    // twitchUsername is the actual username (e.g., "tehchno"), displayName is the display name
    const finalTwitchUsername = twitchUsername || displayName || null;

    res.json({
      id: userId || null,
      twitchUsername: finalTwitchUsername,
      twitchId: twitchUserId || null,
      tiktokUsername: tiktokUsername || null,
      tiktokId: tiktokUserId || null,
      hero
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

/**
 * Link TikTok account
 * POST /api/auth/tiktok/link
 */
router.post('/tiktok/link', verifyToken, async (req, res) => {
  try {
    const { code } = req.body;
    const { userId } = req.user;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // TODO: Implement TikTok OAuth flow when ready
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'TikTok linking coming soon!'
    });
  } catch (error) {
    console.error('TikTok linking error:', error);
    res.status(500).json({ error: 'Failed to link TikTok account' });
  }
});

/**
 * Logout (client-side should remove token)
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  // JWT tokens are stateless, so logout is handled client-side
  // This endpoint exists for completeness
  res.json({ success: true, message: 'Logged out successfully' });
});

export default router;
export { verifyToken };
