import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { ROLE_CONFIG } from '../data/roleConfig.js';
import fetch from 'node-fetch';

const router = express.Router();

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
    
    // Determine battlefield ID - prefer username over ID for consistency
    const battlefieldId = `twitch:${normalizedStreamerUsername}`;

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
    } else if (!existingHeroesSnapshot.empty) {
      // Use the most recently active hero (by lastActiveAt, fallback to updatedAt)
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
    }

    // Handle existing hero
    if (hero) {
      // Check if hero is moving from a different battlefield
      const oldBattlefieldId = hero.currentBattlefieldId || 'world';
      const isMovingBattlefield = oldBattlefieldId !== battlefieldId;
      
      // If moving battlefields, broadcast to old battlefield FIRST (before updating)
      // This ensures immediate removal from the old battlefield
      if (isMovingBattlefield && oldBattlefieldId && oldBattlefieldId !== battlefieldId && oldBattlefieldId !== 'world') {
        try {
          const { broadcastToRoom } = await import('../websocket/server.js');
          const heroName = hero.name || hero.characterName || viewerUsername;
          const oldRoomId = oldBattlefieldId;
          
          console.log(`📡 Broadcasting hero_left_battlefield to old room: ${oldRoomId} (before update)`);
          broadcastToRoom(oldRoomId, {
            type: 'hero_left_battlefield',
            hero: { ...hero, id: hero.id },
            message: `${heroName} has joined another battle with ${normalizedStreamerUsername}`,
            newBattlefieldId: battlefieldId,
            timestamp: Date.now()
          });
        } catch (broadcastError) {
          console.warn('Failed to broadcast hero_left_battlefield to old battlefield:', broadcastError);
          // Continue with update even if broadcast fails
        }
      }
      
      // Update existing hero's battlefield assignment and lastActiveAt
      const heroRef = db.collection('heroes').doc(hero.id);
      await heroRef.update({
        currentBattlefieldId: battlefieldId,
        currentBattlefieldType: 'streamer',
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      const updatedHero = await heroRef.get();
      const heroData = { ...updatedHero.data(), id: updatedHero.id };
      
      // Always broadcast to new battlefield that hero joined (for real-time browser source updates)
      // This ensures the browser source updates immediately, even when rejoining the same battlefield
      try {
        const { broadcastToRoom } = await import('../websocket/server.js');
        const heroName = heroData.name || heroData.characterName || viewerUsername;
        const newRoomId = battlefieldId; // Already in format "twitch:username"
        
        // Convert battlefield ID (twitch:username) to Twitch ID (numeric) for WebSocket room
        // The WebSocket server expects numeric Twitch IDs
        let streamerTwitchId = null;
        if (newRoomId.startsWith('twitch:')) {
          // Extract username from battlefieldId
          const streamerUsername = newRoomId.replace('twitch:', '').toLowerCase();
          // Look up streamer's Twitch ID from their hero document
          const streamerHeroSnapshot = await db.collection('heroes')
            .where('twitchUsername', '==', streamerUsername)
            .limit(1)
            .get();
          
          if (!streamerHeroSnapshot.empty) {
            const streamerHero = streamerHeroSnapshot.docs[0].data();
            streamerTwitchId = streamerHero.twitchUserId || streamerHero.twitchId;
          }
        } else {
          // If it's already a numeric ID, use it directly
          streamerTwitchId = newRoomId;
        }
        
        if (streamerTwitchId) {
          console.log(`📡 Broadcasting hero_joined_battlefield to Twitch ID: ${streamerTwitchId} (battlefield: ${newRoomId})`);
          broadcastToRoom(String(streamerTwitchId), {
            type: 'hero_joined_battlefield',
            hero: heroData,
            message: `${heroName} has joined ${normalizedStreamerUsername}'s battlefield`,
            oldBattlefieldId: isMovingBattlefield ? oldBattlefieldId : null,
            timestamp: Date.now()
          });
        } else {
          console.warn(`⚠️ Could not find streamer Twitch ID for battlefield: ${newRoomId}`);
        }
      } catch (broadcastError) {
        console.warn('Failed to broadcast hero_joined_battlefield to new battlefield:', broadcastError);
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
      let role = classKey || 'berserker';
      
      // Handle category shortcuts (tank, healer, dps)
      if (role === 'tank') {
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

      // Create new hero
      const config = ROLE_CONFIG[role];
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
          weapon: null,
          armor: null,
          accessory: null,
          shield: null,
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
