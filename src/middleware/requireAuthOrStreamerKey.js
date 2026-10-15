/**
 * requireAuthOrStreamerKey Middleware
 * 
 * Accepts either:
 * (a) Valid user JWT via Authorization header (standard auth)
 * (b) Valid X-Streamer-Key for a streamer
 * 
 * When using streamer key (case b), operations are restricted to that streamer's battlefield:
 * - Heroes must be on the streamer's battlefield
 * - Instances must belong to the streamer's battlefield
 * - Rewards are clamped to server-side caps
 * 
 * A streamer key can NEVER act on another streamer's heroes or instances.
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../index.js';
import { JWT_SECRET } from '../config/jwt.js';

export async function requireAuthOrStreamerKey(req, res, next) {
  try {
    // Try JWT first (Authorization: Bearer <token>)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        req.authType = 'jwt';
        return next();
      } catch (jwtError) {
        // JWT invalid, try streamer key
      }
    }
    
    // Try X-Streamer-Key
    const streamerKey = req.headers['x-streamer-key'];
    if (!streamerKey) {
      return res.status(401).json({ error: 'Authentication required: provide JWT or X-Streamer-Key' });
    }
    
    // Find streamer by overlay key (collection is 'streamerSettings')
    const settingsSnapshot = await db.collection('streamerSettings')
      .where('overlayKey', '==', streamerKey)
      .limit(1)
      .get();
    
    if (settingsSnapshot.empty) {
      return res.status(401).json({ error: 'Invalid streamer key' });
    }
    
    const settingsDoc = settingsSnapshot.docs[0];
    const settings = settingsDoc.data();
    const twitchId = settingsDoc.id; // Use doc id as twitchId
    
    // Attach streamer info to request
    req.streamer = {
      twitchId: twitchId,
      twitchUsername: settings.twitchUsername || twitchId,
      battlefieldId: `twitch:${twitchId}`,
      overlayKey: streamerKey
    };
    req.authType = 'streamer-key';
    
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
}

/**
 * Validate that a hero belongs to the authenticated streamer's battlefield
 * Only enforced when auth type is 'streamer-key'
 */
export async function validateHeroOnBattlefield(req, heroId) {
  if (req.authType !== 'streamer-key') {
    return true; // JWT auth doesn't need battlefield validation
  }
  
  const heroDoc = await db.collection('heroes').doc(heroId).get();
  if (!heroDoc.exists) {
    return false;
  }
  
  const hero = heroDoc.data();
  const heroBattlefieldId = hero.currentBattlefieldId;
  const expectedBattlefieldId = req.streamer.battlefieldId;
  
  return heroBattlefieldId === expectedBattlefieldId;
}

/**
 * Validate that all heroes in a list belong to the authenticated streamer's battlefield
 * Only enforced when auth type is 'streamer-key'
 */
export async function validateHeroesOnBattlefield(req, heroIds) {
  if (req.authType !== 'streamer-key') {
    return { valid: true, invalidHeroes: [] };
  }
  
  const invalidHeroes = [];
  
  for (const heroId of heroIds) {
    const isValid = await validateHeroOnBattlefield(req, heroId);
    if (!isValid) {
      invalidHeroes.push(heroId);
    }
  }
  
  return {
    valid: invalidHeroes.length === 0,
    invalidHeroes
  };
}

/**
 * Validate that a user's hero belongs to the authenticated streamer's battlefield
 * Looks up hero by twitchUserId
 */
export async function validateUserOnBattlefield(req, twitchUserId) {
  if (req.authType !== 'streamer-key') {
    return true;
  }
  
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', twitchUserId)
    .limit(1)
    .get();
  
  if (heroesSnapshot.empty) {
    return false;
  }
  
  const hero = heroesSnapshot.docs[0].data();
  return hero.currentBattlefieldId === req.streamer.battlefieldId;
}

/**
 * Clamp rewards for streamer-key authenticated requests
 * Prevents overlay from awarding excessive rewards
 */
export function clampRewards(req, rewards) {
  if (req.authType !== 'streamer-key') {
    return rewards; // JWT auth doesn't need clamping
  }
  
  const MAX_XP_PER_CALL = 10000;
  const MAX_GOLD_PER_CALL = 5000;
  const MAX_ITEMS_PER_CALL = 10;
  
  return {
    ...rewards,
    xp: rewards.xp ? Math.min(rewards.xp, MAX_XP_PER_CALL) : rewards.xp,
    gold: rewards.gold ? Math.min(rewards.gold, MAX_GOLD_PER_CALL) : rewards.gold,
    items: rewards.items ? rewards.items.slice(0, MAX_ITEMS_PER_CALL) : rewards.items
  };
}
