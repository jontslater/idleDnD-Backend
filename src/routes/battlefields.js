import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { getBattlefieldCache } from '../utils/battlefieldCache.js';

const router = express.Router();

// Get all heroes in a specific battlefield
router.get('/:battlefieldId/heroes', async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    const battlefieldCache = getBattlefieldCache();
    
    // Check cache first
    let heroes = battlefieldCache.get(battlefieldId);
    
    if (!heroes) {
      // Cache miss - fetch from Firestore
      const snapshot = await db.collection('heroes')
        .where('currentBattlefieldId', '==', battlefieldId)
        .get();
      
      heroes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      
      // Cache the result
      battlefieldCache.set(battlefieldId, heroes);
    }
    
    res.json(heroes);
  } catch (error) {
    console.error('Error fetching battlefield heroes:', error);
    res.status(500).json({ error: 'Failed to fetch battlefield heroes' });
  }
});

// Get all active battlefields
router.get('/active', async (req, res) => {
  try {
    // Get unique battlefield IDs from heroes
    const snapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '!=', null)
      .get();
    
    const battlefields = new Set();
    snapshot.docs.forEach(doc => {
      const hero = doc.data();
      if (hero.currentBattlefieldId) {
        battlefields.add(hero.currentBattlefieldId);
      }
    });
    
    // Get battlefield info
    const battlefieldList = Array.from(battlefields).map(id => {
      const type = id === 'world' ? 'world' : id.startsWith('twitch:') ? 'streamer' : 'unknown';
      return {
        id,
        type,
        heroCount: snapshot.docs.filter(doc => doc.data().currentBattlefieldId === id).length
      };
    });
    
    res.json(battlefieldList);
  } catch (error) {
    console.error('Error fetching active battlefields:', error);
    res.status(500).json({ error: 'Failed to fetch active battlefields' });
  }
});

// Get full battlefield state (heroes, enemies, background, effects, etc.)
router.get('/:battlefieldId/state', async (req, res) => {
  try {
    // Decode the battlefieldId in case it was URL encoded
    const { battlefieldId } = req.params;
    const decodedBattlefieldId = decodeURIComponent(battlefieldId);
    const battlefieldCache = getBattlefieldCache();
    
    // Check cache first
    let cachedHeroes = battlefieldCache.get(decodedBattlefieldId);
    let heroes;
    
    if (cachedHeroes) {
      // Use cached heroes but format them for state response
      heroes = cachedHeroes.map(hero => ({
        id: hero.id,
        ...hero,
        spriteImage: hero.spriteImage || null,
        spritePosition: hero.spritePosition || null
      }));
    } else {
      // Cache miss - fetch from Firestore
      const heroesSnapshot = await db.collection('heroes')
        .where('currentBattlefieldId', '==', decodedBattlefieldId)
        .get();
      
      heroes = heroesSnapshot.docs.map(doc => {
        const hero = doc.data();
        return {
          id: doc.id,
          ...hero,
          spriteImage: hero.spriteImage || null,
          spritePosition: hero.spritePosition || null
        };
      });
      
      // Cache the result
      battlefieldCache.set(decodedBattlefieldId, heroes);
    }
    
    // For now, return basic state
    // TODO: Add enemy state, combat log, effects when Electron app syncs this data
    res.json({
      battlefieldId: decodedBattlefieldId,
      heroes,
      currentEnemy: null, // Will be populated when Electron app syncs combat state
      enemies: [], // Will be populated when Electron app syncs combat state
      background: 'forest', // Default background, can be customized per battlefield
      combatLog: [], // Will be populated when Electron app syncs combat log
      inCombat: false,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching battlefield state:', error);
    res.status(500).json({ error: 'Failed to fetch battlefield state' });
  }
});

// Register browser source association
// This also attempts to initialize chat listener if not already active
router.post('/register', async (req, res) => {
  try {
    const { battlefieldId, userId, token } = req.body;
    
    if (!battlefieldId || !userId) {
      return res.status(400).json({ error: 'battlefieldId and userId are required' });
    }
    
    // Store browser source association
    await db.collection('browserSources').doc(`${battlefieldId}_${userId}`).set({
      battlefieldId,
      userId,
      registeredAt: admin.firestore.FieldValue.serverTimestamp(),
      lastAccessed: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // If this is a streamer battlefield (twitch:username or twitch:numericId), try to initialize chat listener
    if (battlefieldId.startsWith('twitch:')) {
      const identifier = battlefieldId.replace('twitch:', '').trim();
      console.log(`🔍 Browser source registered for ${identifier} - checking chat listener...`);
      
      // Check if it's a numeric Twitch ID (like "1087777297")
      const isNumericId = /^\d+$/.test(identifier);
      // Check if it looks like a long alphanumeric user ID (legacy detection)
      const isUserId = identifier.length > 25 || /^[a-z0-9]{20,}$/i.test(identifier);
      
      // Determine if we have a username (for legacy format)
      const streamerUsername = (!isNumericId && !isUserId) ? identifier.toLowerCase() : null;
      
      if (isNumericId || isUserId) {
        // Try to find hero by user ID to get the Twitch username
        console.log(`🔍 Battlefield ID appears to be a user ID (${identifier}). Looking up Twitch username...`);
        
        // Strategy: Find all heroes in this battlefield, the one with a token is likely the streamer
        let heroWithToken = null;
        try {
          const battlefieldHeroes = await db.collection('heroes')
            .where('currentBattlefieldId', '==', battlefieldId)
            .limit(20) // Get up to 20 heroes in this battlefield
            .get();
          
          console.log(`   Found ${battlefieldHeroes.docs.length} hero(es) in battlefield ${battlefieldId}`);
          
          // Look for a hero with a token (likely the streamer)
          for (const doc of battlefieldHeroes.docs) {
            const hero = doc.data();
            if (hero.twitchAccessToken) {
              heroWithToken = { id: doc.id, ...hero };
              console.log(`   Found hero with token: ${hero.twitchUsername || hero.name || 'unknown'} (docId: ${doc.id})`);
              break;
            }
          }
          
          // If no hero with token found, try to get user's Twitch ID from auth and find hero that way
          if (!heroWithToken && userId) {
            // Try to find hero by document ID (userId might be the doc ID)
            try {
              const heroDoc = await db.collection('heroes').doc(userId).get();
              if (heroDoc.exists) {
                const hero = heroDoc.data();
                if (hero.twitchAccessToken) {
                  heroWithToken = { id: heroDoc.id, ...hero };
                  console.log(`   Found hero by userId doc ID: ${hero.twitchUsername || hero.name || 'unknown'}`);
                }
              }
            } catch (err) {
              // Continue
            }
            
            // Also try to find by twitchUserId if we can get it from the user's auth
            // For now, just try to find any hero with this userId in the battlefield
            if (!heroWithToken) {
              for (const doc of battlefieldHeroes.docs) {
                const hero = doc.data();
                // Check if this hero belongs to the user (by checking if doc ID matches or other fields)
                if (doc.id === userId || hero.userId === userId) {
                  if (hero.twitchAccessToken) {
                    heroWithToken = { id: doc.id, ...hero };
                    break;
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error(`   Error querying battlefield heroes:`, err);
        }
        
        if (heroWithToken && heroWithToken.twitchAccessToken) {
          // Get username from twitchUsername, name, or internalName
          const actualUsername = (heroWithToken.twitchUsername || heroWithToken.name || heroWithToken.internalName || 'unknown').toLowerCase();
          console.log(`✅ Found hero with token: ${actualUsername} (docId: ${heroWithToken.id})`);
          console.log(`   twitchUsername: ${heroWithToken.twitchUsername || 'not set'}, name: ${heroWithToken.name || 'not set'}, internalName: ${heroWithToken.internalName || 'not set'}`);
          
          // Use the actual username for chat listener
          const { initializeStreamerChatListener } = await import('../websocket/twitch-events.js');
          try {
            await initializeStreamerChatListener(actualUsername, heroWithToken.twitchAccessToken, heroWithToken.twitchRefreshToken);
            console.log(`✅ Chat listener initialized for ${actualUsername} via browser source registration`);
          } catch (err) {
            console.error(`⚠️  Failed to initialize chat listener:`, err.message || err);
            console.error(`   The OAuth token may not have IRC chat scopes. Consider using a bot account token.`);
            // Don't fail the registration - chat listener is optional
          }
        } else {
          console.log(`ℹ️  Could not find hero with token for battlefield ${battlefieldId}.`);
          if (heroWithToken) {
            console.log(`   Hero found but missing twitchAccessToken. Streamer needs to log in via OAuth.`);
          } else {
            console.log(`   No hero found in battlefield. Streamer needs to log in via OAuth to enable chat commands.`);
          }
          console.log(`   Debug: userId from request: ${userId}, battlefieldId: ${battlefieldId}`);
        }
      } else {
        // It's a username (legacy format) - try to find the streamer's hero and initialize chat listener
        try {
          const heroesSnapshot = await db.collection('heroes')
            .where('twitchUsername', '==', streamerUsername)
            .limit(1)
            .get();
          
          if (!heroesSnapshot.empty) {
            const hero = heroesSnapshot.docs[0].data();
            if (hero.twitchAccessToken) {
              const { initializeStreamerChatListener } = await import('../websocket/twitch-events.js');
              await initializeStreamerChatListener(streamerUsername, hero.twitchAccessToken, hero.twitchRefreshToken);
              console.log(`✅ Chat listener initialized for ${streamerUsername} via browser source registration`);
            } else {
              console.log(`ℹ️  Hero found for ${streamerUsername} but no token stored - streamer needs to log in via OAuth`);
            }
          } else {
          // Try to find any hero in this battlefield (might be the streamer themselves)
          const battlefieldHeroes = await db.collection('heroes')
            .where('currentBattlefieldId', '==', battlefieldId)
            .limit(10)
            .get();
          
          // Look for a hero with a token (likely the streamer)
          let heroWithToken = null;
          for (const doc of battlefieldHeroes.docs) {
            const hero = doc.data();
            if (hero.twitchAccessToken && hero.twitchUsername === streamerUsername) {
              heroWithToken = hero;
              break;
            }
          }
          
          if (heroWithToken && heroWithToken.twitchAccessToken) {
            const { initializeStreamerChatListener } = await import('../websocket/twitch-events.js');
            await initializeStreamerChatListener(streamerUsername, heroWithToken.twitchAccessToken, heroWithToken.twitchRefreshToken);
            console.log(`✅ Chat listener initialized for ${streamerUsername} via browser source registration`);
          } else {
            console.log(`ℹ️  No hero with token found for ${streamerUsername} - chat listener not initialized`);
            console.log(`   Streamer needs to log in via OAuth to enable chat commands`);
          }
        }
      } catch (chatError) {
        console.error(`⚠️  Failed to initialize chat listener for ${streamerUsername}:`, chatError);
        // Don't fail the registration if chat listener fails
      }
      }
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error registering browser source:', error);
    res.status(500).json({ error: 'Failed to register browser source' });
  }
});

// Save sprite facing preferences
router.post('/preferences/sprite-facing', async (req, res) => {
  try {
    const { userId, spriteName, facing } = req.body;
    
    if (!userId || !spriteName || !facing) {
      return res.status(400).json({ error: 'userId, spriteName, and facing are required' });
    }
    
    if (facing !== 'left' && facing !== 'right') {
      return res.status(400).json({ error: 'facing must be "left" or "right"' });
    }
    
    // Store preference in user's document or a preferences collection
    const prefDocRef = db.collection('spritePreferences').doc(`${userId}_${spriteName}`);
    await prefDocRef.set({
      userId,
      spriteName,
      facing,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    res.json({ success: true, spriteName, facing });
  } catch (error) {
    console.error('Error saving sprite facing preference:', error);
    res.status(500).json({ error: 'Failed to save sprite facing preference' });
  }
});

// Helper function to get default facing direction based on role or enemy type
function getDefaultFacingForRole(roleOrEnemyType) {
  if (!roleOrEnemyType) return 'right'; // Default to right if unknown
  
  const normalized = roleOrEnemyType.toLowerCase();
  
  // Define roles that should face LEFT (opposite of default)
  const leftFacingRoles = [
    // HEALERS
    'cleric', 'atoner', 'druid', 'lightbringer', 'shaman', 'mistweaver', 'chronomancer', 'bard',
    // MELEE DPS
    'berserker', 'crusader', 'assassin', 'reaper', 'bladedancer', 'monk', 'stormwarrior', 'hunter'
  ];
  
  // Define enemy types that should face RIGHT (opposite of default)
  // Most enemies face left, but these specific ones face right
  const rightFacingEnemies = [
    'demon lord',
    'adult dragon',
    'baby dragon',
    'headless horseman',
    'masked orc',
    'witch',
    'corrupted high priest',
    'cultist'
  ];
  
  // Check if role should face left (heroes)
  if (leftFacingRoles.includes(normalized)) {
    return 'left';
  }
  
  // Check if it's an enemy that should face right
  if (rightFacingEnemies.includes(normalized)) {
    return 'right';
  }
  
  // Determine default based on whether it's a hero or enemy
  // List of all known enemy types to distinguish from hero roles
  const knownEnemyTypes = [
    'kobold warrior', 'baby dragon', 'imp', 'lizardman', 'masked orc',
    'werewolf', 'skeleton mage', 'witch', 'mimic', 'gryphon', 'minotaur',
    'headless horseman', 'adult dragon', 'demon lord', 'elder dragon',
    'goblin', 'goblin chief', 'corrupted high priest', 'cultist',
    'dragon_1', 'dragon_2', 'dragon_3'
  ];
  
  // If it's an enemy type, default to left (most enemies face left)
  if (knownEnemyTypes.includes(normalized)) {
    return 'left';
  }
  
  // If it's a hero role, default to right (most heroes face right)
  return 'right';
}

// Get sprite facing preferences for a user (with defaults for roles)
router.get('/preferences/sprite-facing/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const snapshot = await db.collection('spritePreferences')
      .where('userId', '==', userId)
      .get();
    
    const preferences = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      preferences[data.spriteName] = data.facing;
    });
    
    // Merge with defaults - defaults only applied if no user preference exists
    // This ensures all roles have a facing direction, but user preferences override defaults
    const defaultPreferences = {};
    
    // Common hero roles with defaults
    const allHeroRoles = [
      // Tanks
      'guardian', 'paladin', 'warden', 'bloodknight', 'vanguard', 'brewmaster',
      // Healers
      'cleric', 'atoner', 'druid', 'lightbringer', 'shaman', 'mistweaver', 'chronomancer', 'bard',
      // Melee DPS
      'berserker', 'crusader', 'assassin', 'reaper', 'bladedancer', 'monk', 'stormwarrior', 'hunter',
      // Ranged DPS
      'mage', 'warlock', 'necromancer', 'ranger', 'shadowpriest', 'mooncaller', 'stormcaller', 'frostmage', 'firemage', 'dragonsorcerer'
    ];
    
    // Common enemy types with defaults
    const allEnemyTypes = [
      'Kobold Warrior', 'Baby Dragon', 'Imp', 'Lizardman', 'Masked Orc',
      'Werewolf', 'Skeleton Mage', 'Witch', 'Mimic', 'Gryphon', 'Minotaur',
      'Headless Horseman', 'Adult Dragon', 'Demon Lord', 'Elder Dragon',
      'Goblin', 'Goblin Chief', 'Corrupted High Priest', 'Cultist',
      'Dragon_1', 'Dragon_2', 'Dragon_3'
    ];
    
    // Add defaults for hero roles
    allHeroRoles.forEach(role => {
      if (!preferences[role]) {
        defaultPreferences[role] = getDefaultFacingForRole(role);
      }
    });
    
    // Add defaults for enemy types
    allEnemyTypes.forEach(enemyType => {
      if (!preferences[enemyType]) {
        defaultPreferences[enemyType] = getDefaultFacingForRole(enemyType);
      }
    });
    
    // Merge user preferences with defaults (user preferences take precedence)
    const mergedPreferences = {
      ...defaultPreferences,
      ...preferences
    };
    
    res.json({ preferences: mergedPreferences });
  } catch (error) {
    console.error('Error fetching sprite facing preferences:', error);
    res.status(500).json({ error: 'Failed to fetch sprite facing preferences' });
  }
});

// Save all sprite facing preferences at once
router.post('/preferences/sprite-facing/bulk', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    
    if (!userId || !preferences) {
      return res.status(400).json({ error: 'userId and preferences are required' });
    }
    
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    
    Object.entries(preferences).forEach(([spriteName, facing]) => {
      if (facing === 'left' || facing === 'right') {
        const prefDocRef = db.collection('spritePreferences').doc(`${userId}_${spriteName}`);
        batch.set(prefDocRef, {
          userId,
          spriteName,
          facing,
          updatedAt: timestamp
        }, { merge: true });
      }
    });
    
    await batch.commit();
    
    res.json({ success: true, savedCount: Object.keys(preferences).length });
  } catch (error) {
    console.error('Error saving bulk sprite facing preferences:', error);
    res.status(500).json({ error: 'Failed to save sprite facing preferences' });
  }
});

// Accumulate enemy kill (stores in memory, awards XP periodically)
// This is the RECOMMENDED endpoint for high-frequency enemy kills
// Reduces API calls by 80-90% compared to immediate awarding
router.post('/:battlefieldId/combat/xp/accumulate', async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    const { baseXP, enemyLevel, enemyName, enemies } = req.body;
    
    // Support both single enemy and batch
    if (enemies && Array.isArray(enemies)) {
      // Batch mode: array of enemies
      if (enemies.some(e => !e.baseXP || !e.level)) {
        return res.status(400).json({ 
          error: 'Each enemy must have baseXP and level' 
        });
      }
      
      const { accumulateEnemyKills } = await import('../services/xpAccumulatorService.js');
      accumulateEnemyKills(battlefieldId, enemies);
      
      res.json({
        success: true,
        message: `Accumulated ${enemies.length} enemy/enemies`,
        accumulated: enemies.length
      });
    } else {
      // Single enemy mode
      if (!baseXP || !enemyLevel) {
        return res.status(400).json({ 
          error: 'baseXP and enemyLevel are required (or use enemies array for batch)' 
        });
      }
      
      if (baseXP <= 0 || enemyLevel <= 0) {
        return res.status(400).json({ 
          error: 'baseXP and enemyLevel must be positive numbers' 
        });
      }
      
      const { accumulateEnemyKill } = await import('../services/xpAccumulatorService.js');
      accumulateEnemyKill(battlefieldId, baseXP, enemyLevel, enemyName || 'Unknown Enemy');
      
      res.json({
        success: true,
        message: 'Enemy kill accumulated',
        accumulated: 1
      });
    }
  } catch (error) {
    console.error('Error accumulating enemy kill:', error);
    res.status(500).json({ error: 'Failed to accumulate enemy kill', details: error.message });
  }
});

// Award XP to heroes when enemies are killed (supports single or batch)
// This is the IMMEDIATE award endpoint - use for important events (level-ups, etc.)
// For regular enemy kills, use /accumulate instead to reduce API calls
router.post('/:battlefieldId/combat/xp', async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    const { baseXP, enemyLevel, enemyName, heroIds, immediate = false } = req.body;
    
    // If immediate=false, use accumulator instead
    if (!immediate) {
      // Redirect to accumulate endpoint
      const { accumulateEnemyKill, accumulateEnemyKills } = await import('../services/xpAccumulatorService.js');
      
      if (Array.isArray(baseXP)) {
        const enemies = baseXP.map((xp, i) => ({
          baseXP: xp,
          level: Array.isArray(enemyLevel) ? enemyLevel[i] : enemyLevel,
          name: Array.isArray(enemyName) ? enemyName[i] : (enemyName || 'Unknown')
        }));
        accumulateEnemyKills(battlefieldId, enemies);
      } else {
        accumulateEnemyKill(battlefieldId, baseXP, enemyLevel, enemyName || 'Unknown Enemy');
      }
      
      return res.json({
        success: true,
        message: 'Enemy kill(s) accumulated (will be awarded periodically)',
        accumulated: Array.isArray(baseXP) ? baseXP.length : 1
      });
    }
    
    if (!baseXP || !enemyLevel) {
      return res.status(400).json({ 
        error: 'baseXP and enemyLevel are required' 
      });
    }
    
    // Validate single or array values
    const baseXPArray = Array.isArray(baseXP) ? baseXP : [baseXP];
    const enemyLevelArray = Array.isArray(enemyLevel) ? enemyLevel : [enemyLevel];
    
    if (baseXPArray.some(xp => xp <= 0) || enemyLevelArray.some(level => level <= 0)) {
      return res.status(400).json({ 
        error: 'baseXP and enemyLevel must be positive numbers' 
      });
    }
    
    const { awardCombatXP } = await import('../services/xpDistributionService.js');
    
    // Pass arrays or single values - service handles both
    const result = await awardCombatXP(
      battlefieldId,
      baseXP,
      enemyLevel,
      {
        enemyName: enemyName || 'Unknown Enemy',
        specificHeroIds: heroIds || null
      }
    );
    
    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Failed to award XP',
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Error awarding combat XP:', error);
    res.status(500).json({ error: 'Failed to award combat XP', details: error.message });
  }
});

// Flush accumulated XP immediately for a battlefield
// Useful for important events (wave completion, level-ups, etc.)
router.post('/:battlefieldId/combat/xp/flush', async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    
    const { flushBattlefieldXP } = await import('../services/xpAccumulatorService.js');
    const result = await flushBattlefieldXP(battlefieldId);
    
    if (!result) {
      return res.json({
        success: true,
        message: 'No accumulated XP to flush',
        flushed: false
      });
    }
    
    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Failed to flush XP',
        message: result.message 
      });
    }
    
    res.json({
      success: true,
      message: 'Accumulated XP flushed and awarded',
      ...result
    });
  } catch (error) {
    console.error('Error flushing accumulated XP:', error);
    res.status(500).json({ error: 'Failed to flush accumulated XP', details: error.message });
  }
});

// Get accumulator status for a battlefield
router.get('/:battlefieldId/combat/xp/status', async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    
    const { getAccumulatorStatus } = await import('../services/xpAccumulatorService.js');
    const status = getAccumulatorStatus(battlefieldId);
    
    if (!status) {
      return res.json({
        success: true,
        message: 'No accumulator found for this battlefield',
        status: null
      });
    }
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error getting accumulator status:', error);
    res.status(500).json({ error: 'Failed to get accumulator status', details: error.message });
  }
});

// Preview XP distribution without awarding (for UI display)
router.post('/:battlefieldId/combat/xp/preview', async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    const { baseXP, enemyLevel } = req.body;
    
    if (!baseXP || !enemyLevel) {
      return res.status(400).json({ 
        error: 'baseXP and enemyLevel are required' 
      });
    }
    
    // Get all heroes in the battlefield
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    if (heroesSnapshot.empty) {
      return res.json({
        baseXP,
        enemyLevel,
        heroesCount: 0,
        distribution: []
      });
    }
    
    const heroes = heroesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    const { previewXPDistribution } = await import('../services/xpDistributionService.js');
    const preview = previewXPDistribution(baseXP, enemyLevel, heroes);
    
    res.json(preview);
  } catch (error) {
    console.error('Error previewing XP distribution:', error);
    res.status(500).json({ error: 'Failed to preview XP distribution', details: error.message });
  }
});

export default router;
