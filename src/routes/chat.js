import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { ROLE_CONFIG } from '../data/roleConfig.js';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * Assess what role the battlefield needs most
 * @param {string} battlefieldId - The battlefield to assess
 * @returns {Promise<string>} - 'tank', 'healer', or 'dps'
 */
async function assessBattlefieldNeeds(battlefieldId) {
  // Get all heroes currently on the battlefield
  const heroesSnapshot = await db.collection('heroes')
    .where('currentBattlefieldId', '==', battlefieldId)
    .get();
  
  if (heroesSnapshot.empty) {
    // No heroes on battlefield - default to tank (every party needs a tank!)
    console.log(`[Assessment] No heroes on battlefield ${battlefieldId} - defaulting to tank`);
    return 'tank';
  }
  
  const heroes = heroesSnapshot.docs.map(doc => doc.data());
  
  // Count heroes by category (tank, healer, dps)
  const counts = { tank: 0, healer: 0, dps: 0 };
  
  heroes.forEach(hero => {
    const category = ROLE_CONFIG[hero.role]?.category || 'dps';
    counts[category] = (counts[category] || 0) + 1;
  });
  
  console.log(`[Assessment] Battlefield ${battlefieldId} composition:`, counts);
  
  // Priority: Healer > Tank > DPS
  // Every party needs at least 1 healer, 1 tank
  if (counts.healer === 0) {
    console.log(`[Assessment] No healers - assigning healer`);
    return 'healer';
  }
  if (counts.tank === 0) {
    console.log(`[Assessment] No tanks - assigning tank`);
    return 'tank';
  }
  
  // If we have healer + tank, return the lowest count
  const lowest = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
  console.log(`[Assessment] Balanced party - assigning lowest count: ${lowest} (${counts[lowest]} existing)`);
  return lowest;
}

/**
 * Generate starter gear for a new hero
 * @param {string} role - The hero's role/class
 * @returns {object} - Equipment object with starter items
 */
function generateStarterGear(role) {
  const category = ROLE_CONFIG[role]?.category || 'dps';
  const displayName = ROLE_CONFIG[role]?.displayName || role;
  
  const gear = {
    weapon: {
      name: `Starter ${displayName} Weapon`,
      rarity: 'common',
      attack: category === 'dps' ? 15 : 10,
      defense: 0,
      hp: 0,
      level: 1
    },
    armor: {
      name: `Starter ${category === 'tank' ? 'Plate' : category === 'healer' ? 'Cloth' : 'Leather'} Armor`,
      rarity: 'common',
      attack: 0,
      defense: category === 'tank' ? 20 : 10,
      hp: category === 'tank' ? 50 : 25,
      level: 1
    }
  };
  
  // Shield for tanks only
  if (category === 'tank') {
    gear.shield = {
      name: 'Starter Shield',
      rarity: 'common',
      attack: 0,
      defense: 15,
      hp: 30,
      level: 1
    };
  }
  
  console.log(`[Starter Gear] Generated ${Object.keys(gear).length} items for ${displayName} (${category})`);
  return gear;
}

/**
 * Handle !join command from Twitch chat
 * POST /api/chat/join
 * Body: {
 *   viewerUsername: string,  // The viewer who typed !join
 *   viewerId: string,          // The viewer's Twitch user ID
 *   streamerUsername: string,  // The streamer's channel (lowercase)
 *   streamerId: string,       // The streamer's Twitch user ID (optional)
 *   class: string             // Optional class name (defaults to 'berserker')
 *   heroIndex: number         // Optional hero index (1-based) from !heroes list
 * }
 */
router.post('/join', async (req, res) => {
  try {
    const { viewerUsername, viewerId, streamerUsername, streamerId, class: classKey, heroIndex } = req.body;

    if (!viewerUsername || !viewerId) {
      return res.status(400).json({ error: 'Viewer username and ID required' });
    }

    if (!streamerUsername) {
      return res.status(400).json({ error: 'Streamer username required' });
    }

    // Normalize streamer username to lowercase
    const normalizedStreamerUsername = streamerUsername.toLowerCase().trim();
    
    // Determine battlefield ID - use Twitch ID for consistency and reliability
    // This ensures we can always find the battlefield, even if streamer has no hero document
    // Format: twitch:12345678 (numeric Twitch user ID)
    const battlefieldId = streamerId ? `twitch:${streamerId}` : `twitch:${normalizedStreamerUsername}`;
    
    console.log(`[Join] Battlefield ID: ${battlefieldId} (streamerId: ${streamerId}, username: ${normalizedStreamerUsername})`);

    // Check if hero already exists for this viewer
    const existingHeroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', viewerId)
      .get();

    let hero = null;
    
    // If heroIndex is provided, select hero by index
    if (heroIndex !== undefined && heroIndex !== null) {
      if (!existingHeroesSnapshot.empty) {
        // Get all heroes ordered by lastActiveAt desc (same order as !heroes)
        const heroes = existingHeroesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        heroes.sort((a, b) => {
          const aTime = a.lastActiveAt?.toMillis?.() ?? new Date(a.lastActiveAt ?? 0).getTime();
          const bTime = b.lastActiveAt?.toMillis?.() ?? new Date(b.lastActiveAt ?? 0).getTime();
          return bTime - aTime;
        });
        
        // Convert 1-based index to 0-based
        const index = parseInt(heroIndex, 10) - 1;
        
        if (isNaN(index) || index < 0 || index >= heroes.length) {
          return res.status(400).json({ 
            error: `@${viewerUsername} Invalid hero number. Use !heroes to see your characters.` 
          });
        }
        
        hero = heroes[index];
      } else {
        return res.status(400).json({ 
          error: `@${viewerUsername} No characters found. Use !join [class] to create one!` 
        });
      }
    } else if (!existingHeroesSnapshot.empty && !classKey) {
      // Use the most recently active hero ONLY if no specific class was requested
      // If user types "!join bloodknight", they want a NEW bloodknight, not their existing monk
      const heroes = existingHeroesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      heroes.sort((a, b) => {
        // Prefer lastActiveAt, fallback to updatedAt
        const aTime = a.lastActiveAt?.toMillis?.() ?? 
                     a.updatedAt?.toMillis?.() ?? 
                     new Date(a.lastActiveAt ?? a.updatedAt ?? 0).getTime();
        const bTime = b.lastActiveAt?.toMillis?.() ?? 
                     b.updatedAt?.toMillis?.() ?? 
                     new Date(b.lastActiveAt ?? b.updatedAt ?? 0).getTime();
        return bTime - aTime;
      });
      hero = heroes[0];
      console.log(`[Join] Using existing hero: ${hero.name} (${hero.role})`);
    }

    // Handle existing hero - Use TRANSACTION for atomicity
    if (hero) {
      console.log(`[Join] 🔒 Using transaction to join ${hero.name} (${hero.id}) to battlefield ${battlefieldId}`);
      
      // Collect data before transaction
      const oldBattlefieldId = hero.currentBattlefieldId || 'world';
      const isMovingBattlefield = oldBattlefieldId !== battlefieldId;
      
      // Execute atomic transaction to update all heroes
      let transactionResult;
      try {
        transactionResult = await db.runTransaction(async (transaction) => {
          // 1. Get all user's heroes in the transaction
          const allUserHeroesSnapshot = await transaction.get(
            db.collection('heroes').where('twitchUserId', '==', viewerId)
          );
          
          const allHeroes = allUserHeroesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const selectedHero = allHeroes.find(h => h.id === hero.id);
          
          if (!selectedHero) {
            throw new Error('Hero not found in transaction');
          }
          
          // 2. Clear ALL other heroes' battlefield assignments
          const otherHeroes = allHeroes.filter(h => h.id !== hero.id && h.currentBattlefieldId);
          
          for (const otherHero of otherHeroes) {
            const otherHeroRef = db.collection('heroes').doc(otherHero.id);
            transaction.update(otherHeroRef, {
              currentBattlefieldId: admin.firestore.FieldValue.delete(),
              currentBattlefieldType: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
          
          // 3. Update selected hero's battlefield assignment
          const heroRef = db.collection('heroes').doc(hero.id);
          transaction.update(heroRef, {
            currentBattlefieldId: battlefieldId,
            currentBattlefieldType: 'streamer',
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          return { selectedHero, otherHeroes };
        });
        
        console.log(`✅ [Join] Transaction succeeded - ${transactionResult.otherHeroes.length} other heroes cleared, hero ${hero.id} assigned to ${battlefieldId}`);
      } catch (transactionError) {
        console.error('❌ [Join] Transaction failed:', transactionError);
        return res.status(500).json({ error: 'Failed to join battlefield - transaction error' });
      }
      
      // AFTER transaction succeeds, broadcast removals (non-critical)
      try {
        const { broadcastToRoom } = await import('../websocket/server.js');
        
        // Broadcast removal for each other hero that was on a battlefield
        for (const otherHero of transactionResult.otherHeroes) {
          const otherBattlefieldId = otherHero.currentBattlefieldId;
          
          // Extract Twitch ID from battlefield ID for broadcast
          let otherStreamerTwitchId = null;
          if (otherBattlefieldId.startsWith('twitch:')) {
            const identifier = otherBattlefieldId.replace('twitch:', '');
            if (/^\d+$/.test(identifier)) {
              otherStreamerTwitchId = identifier;
            } else {
              // Legacy username format - look up
              const snapshot = await db.collection('heroes')
                .where('twitchUsername', '==', identifier.toLowerCase())
                .limit(1)
                .get();
              if (!snapshot.empty) {
                otherStreamerTwitchId = snapshot.docs[0].data().twitchUserId;
              }
            }
          }
          
          // Broadcast removal from old battlefield
          if (otherStreamerTwitchId) {
            console.log(`📡 [Join] Broadcasting removal of ${otherHero.name} from battlefield ${otherBattlefieldId}`);
            broadcastToRoom(String(otherStreamerTwitchId), {
              type: 'hero_left_battlefield',
              hero: { ...otherHero, id: otherHero.id },
              message: `${otherHero.name || viewerUsername} switched to another character`,
              timestamp: Date.now()
            });
          }
        }
      } catch (broadcastError) {
        console.error('❌ [Join] Error broadcasting hero removals (non-fatal):', broadcastError);
        // Continue even if broadcast fails - Firebase listeners will still update
      }
      
      // If hero was moving from another battlefield, broadcast removal
      if (isMovingBattlefield && oldBattlefieldId && oldBattlefieldId !== battlefieldId && oldBattlefieldId !== 'world') {
        try {
          const { broadcastToRoom } = await import('../websocket/server.js');
          const heroName = hero.name || hero.characterName || viewerUsername;
          
          // Extract Twitch ID from old battlefield ID
          // New format: twitch:12345678 (numeric ID)
          // Old format: twitch:username (legacy, needs lookup)
          let oldStreamerTwitchId = null;
          
          if (oldBattlefieldId.startsWith('twitch:')) {
            const identifier = oldBattlefieldId.replace('twitch:', '');
            
            // Check if it's already a numeric ID (new format)
            if (/^\d+$/.test(identifier)) {
              oldStreamerTwitchId = identifier;
              console.log(`[Join] Old battlefield uses numeric ID format: ${oldStreamerTwitchId}`);
            } else {
              // Legacy format (username) - need to look up
              console.warn(`[Join] Old battlefield uses legacy username format, looking up Twitch ID...`);
              const oldStreamerHeroSnapshot = await db.collection('heroes')
                .where('twitchUsername', '==', identifier.toLowerCase())
                .limit(1)
                .get();
              
              if (!oldStreamerHeroSnapshot.empty) {
                const oldStreamerHero = oldStreamerHeroSnapshot.docs[0].data();
                oldStreamerTwitchId = oldStreamerHero.twitchUserId || oldStreamerHero.twitchId;
                console.log(`[Join] Found Twitch ID from hero lookup: ${oldStreamerTwitchId}`);
              } else {
                console.error(`❌ [Join] CRITICAL: Could not find Twitch ID for old battlefield username: ${identifier}`);
                console.error(`   Hero will NOT be removed from old battlefield!`);
                console.error(`   Streamer '${identifier}' needs to log in at least once to create hero document.`);
              }
            }
          }
          
          if (oldStreamerTwitchId) {
            console.log(`📡 [Join] Broadcasting hero_left_battlefield to old battlefield Twitch ID: ${oldStreamerTwitchId} (battlefield: ${oldBattlefieldId})`);
            broadcastToRoom(String(oldStreamerTwitchId), {
              type: 'hero_left_battlefield',
              hero: { ...hero, id: hero.id },
              message: `${heroName} has joined another battle with ${normalizedStreamerUsername}`,
              newBattlefieldId: battlefieldId,
              timestamp: Date.now()
            });
            console.log(`✅ [Join] Successfully broadcast hero removal from old battlefield`);
          } else {
            console.error(`❌ [Join] CRITICAL: Failed to broadcast hero removal - no Twitch ID available`);
            console.error(`   Old battlefield: ${oldBattlefieldId}`);
            console.error(`   Hero ${hero.id} will be duplicated on both battlefields!`);
          }
        } catch (broadcastError) {
          console.error('❌ [Join] Failed to broadcast hero_left_battlefield to old battlefield:', broadcastError);
          // Continue with update even if broadcast fails
        }
      }
      
      // Get updated hero data after transaction
      const heroRef = db.collection('heroes').doc(hero.id);
      const updatedHero = await heroRef.get();
      const heroData = { ...updatedHero.data(), id: updatedHero.id };
      
      // CRITICAL: Verify the write succeeded
      if (heroData.currentBattlefieldId === battlefieldId) {
        console.log(`✅ [Join] Verified Firebase write - Hero ${hero.id} successfully assigned to battlefield: ${battlefieldId}`);
      } else {
        console.error(`❌ [Join] CRITICAL: Firebase write verification FAILED!`);
        console.error(`   Expected: ${battlefieldId}`);
        console.error(`   Got: ${heroData.currentBattlefieldId}`);
        console.error(`   Hero ${hero.id} may not persist through reload!`);
      }
      
      // Always broadcast to new battlefield that hero joined (for real-time browser source updates)
      // This ensures the browser source updates immediately, even when rejoining the same battlefield
      try {
        const { broadcastToRoom } = await import('../websocket/server.js');
        const heroName = heroData.name || heroData.characterName || viewerUsername;
        
        // Extract Twitch ID from new battlefield ID
        // New format: twitch:12345678 (should always be numeric now since we set it above)
        let newStreamerTwitchId = null;
        
        if (battlefieldId.startsWith('twitch:')) {
          newStreamerTwitchId = battlefieldId.replace('twitch:', '');
          console.log(`[Join] New battlefield Twitch ID: ${newStreamerTwitchId}`);
        }
        
        if (newStreamerTwitchId) {
          console.log(`📡 [Join] Broadcasting hero_joined_battlefield to Twitch ID: ${newStreamerTwitchId} (battlefield: ${battlefieldId})`);
          broadcastToRoom(String(newStreamerTwitchId), {
            type: 'hero_joined_battlefield',
            hero: heroData,
            message: `${heroName} has joined ${normalizedStreamerUsername}'s battlefield`,
            oldBattlefieldId: isMovingBattlefield ? oldBattlefieldId : null,
            timestamp: Date.now()
          });
          console.log(`✅ [Join] Successfully broadcast hero join to new battlefield`);
        } else {
          console.error(`❌ [Join] CRITICAL: Could not extract Twitch ID from battlefield: ${battlefieldId}`);
        }
      } catch (broadcastError) {
        console.error('❌ [Join] Failed to broadcast hero_joined_battlefield to new battlefield:', broadcastError);
        // Continue even if broadcast fails - Firebase listener will still update
      }
      
      const roleName = ROLE_CONFIG[heroData.role]?.displayName || heroData.role;
      const message = isMovingBattlefield 
        ? `${heroData.name || viewerUsername} has joined ${normalizedStreamerUsername}'s battlefield as ${roleName} Lv${heroData.level || 1}`
        : `${viewerUsername} rejoined ${normalizedStreamerUsername}'s battlefield as ${roleName} Lv${heroData.level || 1}`;
      
      return res.json({
        success: true,
        message: message,
        hero: heroData,
        isNewHero: false,
        movedFromBattlefield: isMovingBattlefield ? oldBattlefieldId : null
      });
    }

    // If no hero found and no heroIndex specified, create a new hero
    if (!hero) {
      // Determine class to join as
      let role = classKey;
      
      // If no class specified, assess what the battlefield needs
      if (!role) {
        console.log(`[Join] No class specified - assessing battlefield needs for ${viewerUsername}`);
        const neededCategory = await assessBattlefieldNeeds(battlefieldId);
        console.log(`[Join] Battlefield needs: ${neededCategory}. Auto-selecting...`);
        
        // Pick a random class from the needed category
        const classesInCategory = Object.keys(ROLE_CONFIG).filter(
          k => ROLE_CONFIG[k].category === neededCategory
        );
        role = classesInCategory[Math.floor(Math.random() * classesInCategory.length)];
        
        console.log(`[Join] 🎯 Auto-selected: ${role} (${ROLE_CONFIG[role].displayName}) for ${viewerUsername}`);
      }
      // Handle category shortcuts (tank, healer, dps) - user override
      else if (role === 'tank') {
        const tankClasses = Object.keys(ROLE_CONFIG).filter(k => ROLE_CONFIG[k].category === 'tank');
        role = tankClasses[Math.floor(Math.random() * tankClasses.length)];
      } else if (role === 'healer') {
        const healerClasses = Object.keys(ROLE_CONFIG).filter(k => ROLE_CONFIG[k].category === 'healer');
        role = healerClasses[Math.floor(Math.random() * healerClasses.length)];
      } else if (role === 'dps') {
        const dpsClasses = Object.keys(ROLE_CONFIG).filter(k => ROLE_CONFIG[k].category === 'dps');
        role = dpsClasses[Math.floor(Math.random() * dpsClasses.length)];
      }

      // Validate class
      if (!ROLE_CONFIG[role]) {
        return res.status(400).json({ error: `Invalid class: ${role}` });
      }

      // Create new hero with starter gear and XP boost
      const config = ROLE_CONFIG[role];
      const starterGear = generateStarterGear(role);
      
      console.log(`[Join] 🎁 Creating new hero for ${viewerUsername} with starter gear and XP boost`);
      
      const heroData = {
        name: viewerUsername,
        twitchUserId: viewerId,
        role: role,
        level: 1,
        hp: config.baseHp,
        maxHp: config.baseHp,
        xp: 0,
        maxXp: 100,
        attack: config.baseAttack,
        defense: config.baseDefense,
        gold: 0,
        tokens: 0,
        totalIdleTokens: 0,
        lastTokenClaim: Date.now(),
        lastCommandTime: Date.now(),
        equipment: {
          weapon: starterGear.weapon || null,
          armor: starterGear.armor || null,
          accessory: null,
          shield: starterGear.shield || null,
          helm: null,
          cloak: null,
          gloves: null,
          ring1: null,
          ring2: null,
          boots: null
        },
        inventory: [],
        stats: {
          totalDamage: 0,
          totalHealing: 0,
          damageBlocked: 0
        },
        isDead: false,
        deathTime: null,
        potions: {
          health: 0
        },
        activeBuffs: {},
        shopBuffs: {
          xpBoost: {
            multiplier: 2.0, // 100% bonus XP
            remainingDuration: 3600000, // 1 hour (in milliseconds)
            lastUpdateTime: Date.now(),
            startTime: Date.now()
          }
        },
        profession: null,
        skills: {},
        skillPoints: 0,
        skillPointsEarned: 0,
        joinedAt: Date.now(),
        currentBattlefieldId: battlefieldId,
        currentBattlefieldType: 'streamer',
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      console.log(`[Join] ✨ New hero created with:
        - Role: ${config.displayName} (${role})
        - Starter Gear: ${Object.keys(starterGear).join(', ')}
        - XP Boost: 2.0x for 1 hour
        - Battlefield: ${battlefieldId}`);

      const docRef = await db.collection('heroes').add(heroData);
      const doc = await docRef.get();

      return res.json({
        success: true,
        message: `${viewerUsername} joined ${normalizedStreamerUsername}'s battlefield as ${config.displayName}`,
        hero: { ...doc.data(), id: doc.id },
        isNewHero: true
      });
    }
  } catch (error) {
    console.error('Error handling join command:', error);
    res.status(500).json({ error: 'Failed to process join command' });
  }
});

/**
 * Initialize chat listener for a streamer
 * POST /api/chat/initialize
 * Body: {
 *   streamerUsername: string,  // The streamer's Twitch username
 *   accessToken: string         // Optional - if not provided, will fetch from hero document
 * }
 */
router.post('/initialize', async (req, res) => {
  try {
    const { streamerUsername, accessToken } = req.body;

    if (!streamerUsername) {
      return res.status(400).json({ error: 'Streamer username required' });
    }

    const normalizedUsername = streamerUsername.toLowerCase().trim();

    // If access token provided, use it directly
    if (accessToken) {
      const { initializeStreamerChatListener } = await import('../websocket/twitch-events.js');
      await initializeStreamerChatListener(normalizedUsername, accessToken);
      return res.json({
        success: true,
        message: `Chat listener initialized for ${normalizedUsername}`
      });
    }

    // Otherwise, try to find the hero and use their stored token
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUsername', '==', normalizedUsername)
      .limit(1)
      .get();

    if (heroesSnapshot.empty) {
      // Try by twitchUserId if we have it
      return res.status(404).json({ error: 'Hero not found. Streamer needs to log in first.' });
    }

    const hero = heroesSnapshot.docs[0].data();
    const storedToken = hero.twitchAccessToken;

    if (!storedToken) {
      return res.status(400).json({ error: 'No Twitch token found. Streamer needs to log in via OAuth.' });
    }

    // Initialize chat listener with stored token
    const { initializeStreamerChatListener } = await import('../websocket/twitch-events.js');
    await initializeStreamerChatListener(normalizedUsername, storedToken, hero.twitchRefreshToken);

    return res.json({
      success: true,
      message: `Chat listener initialized for ${normalizedUsername}`
    });
  } catch (error) {
    console.error('Error initializing chat listener:', error);
    res.status(500).json({ error: 'Failed to initialize chat listener', details: error.message });
  }
});

/**
 * Check chat listener status for a streamer
 * GET /api/chat/status
 * Query params: streamerUsername (optional - uses token if not provided)
 */
router.get('/status', async (req, res) => {
  try {
    const { streamerUsername } = req.query;
    
    if (!streamerUsername) {
      return res.status(400).json({ error: 'Streamer username required' });
    }

    const normalizedUsername = streamerUsername.toLowerCase().trim();
    
    // Check if chat listener is active
    const { isStreamerChatListenerConnected } = await import('../websocket/twitch-events.js');
    
    if (isStreamerChatListenerConnected(normalizedUsername)) {
      return res.json({
        connected: true,
        streamerUsername: normalizedUsername,
        message: `Chat listener is active for ${normalizedUsername}`
      });
    } else {
      // Try to initialize if we have a stored token
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUsername', '==', normalizedUsername)
        .limit(1)
        .get();

      if (heroesSnapshot.empty) {
        return res.status(404).json({ 
          connected: false,
          error: 'Hero not found. Streamer needs to log in first.' 
        });
      }

      const hero = heroesSnapshot.docs[0].data();
      const storedToken = hero.twitchAccessToken;

      if (!storedToken) {
        return res.json({
          connected: false,
          streamerUsername: normalizedUsername,
          message: 'No Twitch token found. Please log in via OAuth to initialize chat listener.'
        });
      }

      // Try to initialize
      const { initializeStreamerChatListener } = await import('../websocket/twitch-events.js');
      try {
        await initializeStreamerChatListener(normalizedUsername, storedToken, hero.twitchRefreshToken);
        return res.json({
          connected: true,
          streamerUsername: normalizedUsername,
          message: `Chat listener initialized for ${normalizedUsername}`
        });
      } catch (err) {
        return res.status(500).json({
          connected: false,
          streamerUsername: normalizedUsername,
          error: 'Failed to initialize chat listener',
          details: err.message
        });
      }
    }
  } catch (error) {
    console.error('Error checking chat listener status:', error);
    res.status(500).json({ error: 'Failed to check chat listener status', details: error.message });
  }
});

export default router;
