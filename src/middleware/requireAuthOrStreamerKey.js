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
    const storedKey = settings.overlayKey;
    
    // Timing-safe comparison (even though query already matched)
    try {
      const isValid = crypto.timingSafeEqual(
        Buffer.from(streamerKey),
        Buffer.from(storedKey)
      );
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid streamer key' });
      }
    } catch (compareError) {
      // Length mismatch or other error
      return res.status(401).json({ error: 'Invalid streamer key' });
    }
    
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
export async function validateUserOnBattlefield(req, twitchUserId, heroId = null) {
  if (req.authType !== 'streamer-key') {
    return true;
  }

  if (heroId) {
    return validateHeroOnBattlefield(req, heroId);
  }
  
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', twitchUserId)
    .get();
  
  if (heroesSnapshot.empty) {
    return false;
  }

  const expectedBattlefieldId = req.streamer.battlefieldId;
  return heroesSnapshot.docs.some(
    (doc) => doc.data().currentBattlefieldId === expectedBattlefieldId
  );
}

/**
 * Clamp rewards for streamer-key authenticated requests
 * Prevents overlay from awarding excessive rewards
 */
export function clampRewards(req, rewards) {
  if (req.authType !== 'streamer-key' || !rewards) {
    return rewards; // JWT auth doesn't need clamping
  }
  
  const MAX_XP_PER_CALL = 10000;
  const MAX_GOLD_PER_CALL = 5000;
  const MAX_ITEMS_PER_CALL = 10;
  
  const clamped = { ...rewards };
  if (typeof clamped.xp === 'number') {
    clamped.xp = Math.min(clamped.xp, MAX_XP_PER_CALL);
  }
  if (typeof clamped.gold === 'number') {
    clamped.gold = Math.min(clamped.gold, MAX_GOLD_PER_CALL);
  }
  if (Array.isArray(clamped.items)) {
    clamped.items = clamped.items.slice(0, MAX_ITEMS_PER_CALL);
  }
  return clamped;
}

/** @returns {boolean} false if response already sent */
export function assertStreamerInstanceAccess(req, res, instance) {
  if (req.authType !== 'streamer-key') {
    return true;
  }
  if (!instance?.battlefieldId || instance.battlefieldId !== req.streamer.battlefieldId) {
    res.status(403).json({ error: 'Instance not on your battlefield' });
    return false;
  }
  return true;
}

function jwtUserIsInstanceParticipant(req, instance) {
  if (req.authType !== 'jwt' || !req.user) return false;
  const ids = instance?.participantIds || [];
  const { userId, twitchUserId } = req.user;
  return ids.includes(userId) || ids.includes(twitchUserId);
}

/** JWT players may not complete instances unless they are registered participants. */
export function assertJwtInstanceParticipant(req, res, instance) {
  if (req.authType !== 'jwt') {
    return true;
  }
  if (!jwtUserIsInstanceParticipant(req, instance)) {
    res.status(403).json({ error: 'Forbidden: you are not a participant in this instance' });
    return false;
  }
  return true;
}

/**
 * When using player JWT, ignore client-supplied participant rosters (anti-spoof).
 * Streamer overlay key may send full participant updates.
 */
export function resolveInstanceParticipants(req, instance, clientParticipants) {
  if (req.authType === 'streamer-key' && Array.isArray(clientParticipants)) {
    return clientParticipants;
  }
  return instance.participants || [];
}

/** @returns {boolean} false if response already sent */
export async function assertParticipantsOnStreamerBattlefield(req, res, participants) {
  if (req.authType === 'jwt') {
    if (!Array.isArray(participants)) {
      return true;
    }
    for (const p of participants) {
      if (!p || typeof p !== 'object') continue;
      const claimed = p.userId || p.heroId;
      const twitchId = p.twitchUserId;
      if (twitchId && twitchId !== req.user.twitchUserId) {
        res.status(403).json({ error: 'Forbidden: cannot modify other players in instance' });
        return false;
      }
      if (claimed && claimed !== req.user.userId && claimed !== req.user.twitchUserId) {
        const heroDoc = await db.collection('heroes').doc(claimed).get();
        if (heroDoc.exists && heroDoc.data().twitchUserId !== req.user.twitchUserId) {
          res.status(403).json({ error: 'Forbidden: cannot modify other players in instance' });
          return false;
        }
      }
    }
    return true;
  }
  if (req.authType !== 'streamer-key' || !Array.isArray(participants)) {
    return true;
  }
  for (const p of participants) {
    if (!p || typeof p !== 'object') {
      continue;
    }
    if (p.twitchUserId) {
      const ok = await validateUserOnBattlefield(req, p.twitchUserId, p.heroId || null);
      if (!ok) {
        res.status(403).json({
          error: 'Forbidden: hero not on your battlefield',
          userId: p.twitchUserId
        });
        return false;
      }
    }
    if (p.userId) {
      const ok = await validateHeroOnBattlefield(req, p.userId);
      if (!ok) {
        res.status(403).json({
          error: 'Forbidden: hero not on your battlefield',
          userId: p.userId
        });
        return false;
      }
    }
  }
  return true;
}

/** Validate a single user/hero id from command/chat bodies */
export async function assertActorOnStreamerBattlefield(req, res, userId) {
  if (req.authType !== 'streamer-key' || !userId) {
    return true;
  }
  const onBf = await validateUserOnBattlefield(req, userId);
  if (onBf) {
    return true;
  }
  const heroOk = await validateHeroOnBattlefield(req, userId);
  if (!heroOk) {
    res.status(403).json({ error: 'Forbidden: hero not on your battlefield', userId });
    return false;
  }
  return true;
}
