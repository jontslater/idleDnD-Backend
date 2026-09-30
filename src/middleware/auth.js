/**
 * Authentication Middleware
 * Comprehensive identity verification for all protected routes
 */

import jwt from 'jsonwebtoken';
import { db } from '../index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
 */
export const requireAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
  const expectedKey = process.env.ADMIN_KEY;
  
  if (!expectedKey) {
    return res.status(503).json({ 
      error: 'Admin operations are disabled (ADMIN_KEY not configured)' 
    });
  }
  
  if (adminKey !== expectedKey) {
    return res.status(403).json({ error: 'Invalid admin credentials' });
  }
  
  next();
};

/**
 * Verify streamer/overlay access for streamer-scoped routes
 * Checks X-Streamer-Key header or streamer ownership
 * Use for overlay sync and chat activity endpoints
 */
export const requireStreamerAccess = async (req, res, next) => {
  const streamerId = req.params.streamerId || req.body.streamerId;
  const streamerKey = req.headers['x-streamer-key'];
  
  // Option 1: Valid streamer key (for browser source/overlay)
  if (streamerKey && streamerId) {
    // Verify streamer key matches streamer's stored key
    try {
      const settingsDoc = await db.collection('streamerSettings').doc(streamerId).get();
      if (settingsDoc.exists) {
        const settings = settingsDoc.data();
        if (settings.overlayKey === streamerKey) {
          return next();
        }
      }
    } catch (error) {
      console.error('[Auth] Error verifying streamer key:', error);
    }
  }
  
  // Option 2: Authenticated user is the streamer (for portal/dashboard)
  if (req.user && req.user.twitchUserId === streamerId) {
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
