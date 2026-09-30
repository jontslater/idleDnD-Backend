/**
 * Authentication Middleware
 * Comprehensive identity verification for all protected routes
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../index.js';

// JWT_SECRET must be set - fail closed, no defaults
let JWT_SECRET;

if (process.env.JWT_SECRET) {
  JWT_SECRET = process.env.JWT_SECRET;
} else if (process.env.NODE_ENV === 'production') {
  console.error('❌ FATAL: JWT_SECRET is not set in production!');
  console.error('The server cannot start without JWT_SECRET configured.');
  process.exit(1);
} else {
  // Development: generate random per-process secret with loud warning
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  WARNING: JWT_SECRET not set! Generated random per-process secret.');
  console.warn('⚠️  This is INSECURE and sessions will break on restart.');
  console.warn('⚠️  Set JWT_SECRET environment variable before production deployment.');
}

/**
 * Verify JWT token and attach user identity to request
 * Used for routes that require any authenticated user
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains: userId (hero doc ID), twitchUserId, twitchUsername, displayName
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please log in again.' });
    }
    return res.status(401).json({ error: 'Invalid authentication token.' });
  }
};

/**
 * Verify user owns the resource they're trying to access/modify
 * Checks URL parameter :userId matches authenticated user's ID or Twitch ID
 * Use this for hero-mutating routes like PUT /api/heroes/:userId
 */
export const requireOwnership = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const targetUserId = req.params.userId || req.params.heroId;
  const { userId, twitchUserId } = req.user;
  
  // Allow if:
  // 1. Target is user's hero document ID, OR
  // 2. Target is user's Twitch ID
  if (targetUserId === userId || targetUserId === twitchUserId) {
    return next();
  }
  
  // Also check if the target is a hero that belongs to this user
  // This handles cases where client sends hero doc ID but we need to verify ownership
  db.collection('heroes').doc(targetUserId).get()
    .then(doc => {
      if (doc.exists) {
        const hero = doc.data();
        if (hero.twitchUserId === twitchUserId) {
          return next();
        }
      }
      return res.status(403).json({ 
        error: 'Forbidden: You can only modify your own resources' 
      });
    })
    .catch(error => {
      console.error('[Auth] Error verifying ownership:', error);
      return res.status(500).json({ error: 'Authorization check failed' });
    });
};

/**
 * Verify admin access via ADMIN_KEY environment variable
 * Use for destructive operations like test cleanup
 * Uses timing-safe comparison to prevent timing attacks
 */
export const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key']; // Only from header, not body
  const expectedKey = process.env.ADMIN_KEY;
  
  if (!expectedKey) {
    return res.status(503).json({ 
      error: 'Admin operations are disabled (ADMIN_KEY not configured)' 
    });
  }
  
  if (!adminKey) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  
  // Timing-safe comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(adminKey),
      Buffer.from(expectedKey)
    );
    
    if (!isValid) {
      return res.status(403).json({ error: 'Invalid admin credentials' });
    }
  } catch (error) {
    // Length mismatch or other error
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  
  next();
};

/**
 * Verify streamer/overlay access for streamer-scoped routes
 * Checks X-Streamer-Key header or streamer ownership
 * Uses timing-safe comparison for key validation
 * Use for overlay sync and chat activity endpoints
 */
export const requireStreamerAccess = async (req, res, next) => {
  const streamerId = req.params.streamerId || req.body.streamerId;
  const streamerKey = req.headers['x-streamer-key'];
  
  if (!streamerId) {
    return res.status(400).json({ error: 'Streamer ID required' });
  }
  
  // Option 1: Valid streamer key (for browser source/overlay)
  if (streamerKey) {
    try {
      const settingsDoc = await db.collection('streamerSettings').doc(streamerId).get();
      if (settingsDoc.exists) {
        const settings = settingsDoc.data();
        const storedKey = settings.overlayKey;
        
        if (storedKey) {
          // Timing-safe comparison to prevent timing attacks
          try {
            const isValid = crypto.timingSafeEqual(
              Buffer.from(streamerKey),
              Buffer.from(storedKey)
            );
            
            if (isValid) {
              req.streamerKeyAuth = true; // Mark as key-authenticated
              return next();
            }
          } catch (compError) {
            // Length mismatch or comparison error - key invalid
          }
        }
      }
    } catch (error) {
      console.error('[Auth] Error verifying streamer key:', error);
    }
  }
  
  // Option 2: Authenticated user is the streamer (for portal/dashboard)
  if (req.user && req.user.twitchUserId === streamerId) {
    req.streamerOwnerAuth = true; // Mark as owner-authenticated
    return next();
  }
  
  return res.status(403).json({ 
    error: 'Forbidden: Streamer authentication required' 
  });
};

/**
 * Optional auth - attach user if token present, but don't require it
 * Use for routes that behave differently for authenticated vs anonymous users
 */
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token present - continue without user
    return next();
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
  } catch (error) {
    // Invalid/expired token - ignore and continue without user
    // Don't return error for optional auth
  }
  
  next();
};

/**
 * Verify guild membership for guild-scoped routes
 * Requires auth first, then checks if user is a member of the guild
 * Use after requireAuth on guild operation routes
 */
export const requireGuildMembership = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  const guildId = req.params.guildId;
  const { userId, twitchUserId } = req.user;
  
  if (!guildId) {
    return res.status(400).json({ error: 'Guild ID required' });
  }
  
  try {
    // Get guild and check membership
    const guildDoc = await db.collection('guilds').doc(guildId).get();
    
    if (!guildDoc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = guildDoc.data();
    const members = guild.members || [];
    
    // Check if user's hero is a member
    const isMember = members.some(m => m.heroId === userId || m.twitchUserId === twitchUserId);
    
    if (!isMember) {
      return res.status(403).json({ error: 'You are not a member of this guild' });
    }
    
    // Attach guild info to request for convenience
    req.guild = { id: guildId, ...guild };
    req.memberInfo = members.find(m => m.heroId === userId || m.twitchUserId === twitchUserId);
    
    next();
  } catch (error) {
    console.error('[Auth] Error verifying guild membership:', error);
    return res.status(500).json({ error: 'Failed to verify guild membership' });
  }
};

/**
 * Verify guild officer/leader role
 * Requires guild membership first
 * Use after requireGuildMembership for admin operations
 */
export const requireGuildOfficer = (req, res, next) => {
  if (!req.memberInfo) {
    return res.status(403).json({ error: 'Guild membership required' });
  }
  
  const role = req.memberInfo.role;
  if (role !== 'leader' && role !== 'officer') {
    return res.status(403).json({ error: 'Officer or Leader role required' });
  }
  
  next();
};
