import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { tryMatchmaking as tryFlexibleMatchmaking } from './dungeon-matchmaking.js';

const router = express.Router();

// Role normalization: Map hero roles to tank/healer/dps categories
function normalizeRole(heroRole) {
  if (!heroRole) return 'dps';
  
  const roleLower = heroRole.toLowerCase();
  
  // Tank roles
  const tankRoles = ['guardian', 'paladin', 'warden', 'bloodknight', 'vanguard', 'brewmaster'];
  if (tankRoles.includes(roleLower) || roleLower === 'tank') {
    return 'tank';
  }
  
  // Healer roles
  const healerRoles = ['cleric', 'atoner', 'druid', 'lightbringer', 'shaman', 'mistweaver', 'chronomancer', 'bard'];
  if (healerRoles.includes(roleLower) || roleLower === 'healer') {
    return 'healer';
  }
  
  // Everything else is DPS
  return 'dps';
}

// Get queue status (must be before /queue route)
router.get('/queue/status', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const queueSnapshot = await db.collection('dungeonQueue')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (queueSnapshot.empty) {
      return res.json({ inQueue: false });
    }
    
    const queueEntry = queueSnapshot.docs[0].data();
    
    // Get queue counts by role
    const allQueue = await db.collection('dungeonQueue').get();
    const roleCounts = {
      tank: 0,
      healer: 0,
      dps: 0
    };
    
    allQueue.docs.forEach(doc => {
      const entry = doc.data();
      roleCounts[entry.role] = (roleCounts[entry.role] || 0) + 1;
    });
    
    res.json({
      inQueue: true,
      role: queueEntry.role,
      dungeonType: queueEntry.dungeonType,
      queueTime: queueEntry.queuedAt?.toMillis?.() || 0,
      roleCounts,
      estimatedWait: estimateWaitTime(roleCounts, queueEntry.role)
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// Join queue
router.post('/queue', async (req, res) => {
  try {
    const { userId, heroId, role, itemScore, dungeonType = 'normal', dungeonId } = req.body;
    
    if (!userId || !heroId || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if this is a solo dungeon - if so, start immediately
    // Since we're limiting to Goblin Cave for launch, check if it's the only available dungeon
    const { getAllDungeons, getDungeonById } = await import('../data/dungeons.js');
    const allDungeons = getAllDungeons();
    
    // LAUNCH: Only Goblin Cave is available, check if it's solo
    const launchDungeonId = 'goblin_cave';
    const launchDungeon = getDungeonById(launchDungeonId);
    
    // If the only available dungeon is solo (no minPlayers or minPlayers === 1), start it immediately
    if (launchDungeon && launchDungeon.type === 'solo' && (!launchDungeon.minPlayers || launchDungeon.minPlayers === 1)) {
      // Solo dungeon - start immediately without queueing
      console.log(`[Solo Dungeon] Starting ${launchDungeon.name} immediately for ${userId}`);
      
      // Create instance directly using the start endpoint logic
      const heroDoc = await db.collection('heroes').doc(heroId).get();
      if (!heroDoc.exists) {
        return res.status(404).json({ error: 'Hero not found' });
      }
      
      const hero = heroDoc.data();
      const twitchUserId = hero.twitchUserId;
      if (!twitchUserId) {
        return res.status(400).json({ 
          error: `Hero ${heroId} is missing twitchUserId field` 
        });
      }
      
      const participantData = [{
        userId: heroId,
        heroId: heroId,
        twitchUserId: twitchUserId,
        username: hero.name || heroId,
        heroName: hero.name,
        heroRole: hero.role,
        heroLevel: hero.level || 1,
        currentHp: hero.hp || hero.maxHp,
        maxHp: hero.maxHp,
        isAlive: true,
        deaths: 0
      }];
      
      const participantIds = [twitchUserId];
      
      // Create dungeon instance
      const dungeonInstance = {
        dungeonId: launchDungeon.id,
        difficulty: launchDungeon.difficulty || 'normal',
        status: 'active',
        organizerId: userId,
        participants: participantData,
        participantIds: participantIds,
        currentRoom: 0,
        maxRooms: launchDungeon.rooms.length,
        rooms: launchDungeon.rooms,
        combatLog: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const instanceRef = await db.collection('dungeonInstances').add(dungeonInstance);
      
      // Update hero to have activeInstance pointing to this dungeon
      await db.collection('heroes').doc(heroId).update({
        activeInstance: {
          type: 'dungeon',
          instanceId: instanceRef.id
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`[Solo Dungeon] ✅ Created dungeon instance ${instanceRef.id} for ${launchDungeon.name}`);
      
      return res.json({ 
        success: true, 
        soloDungeon: true,
        instanceId: instanceRef.id,
        message: `Started ${launchDungeon.name}`
      });
    }
    
    // Group dungeon - add to queue for matchmaking
    // Normalize role to tank/healer/dps
    const normalizedRole = normalizeRole(role);
    
    // Check if already in queue
    const existingQueue = await db.collection('dungeonQueue')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (!existingQueue.empty) {
      return res.status(400).json({ error: 'Already in queue' });
    }
    
    // Add to queue
    const queueEntry = {
      userId,
      heroId,
      role: normalizedRole, // Use normalized role for matchmaking
      originalRole: role, // Keep original for display
      itemScore: itemScore || 0,
      dungeonType,
      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)) // 30 min
    };
    
    const queueRef = await db.collection('dungeonQueue').add(queueEntry);
    
    // Try to match
    await tryMatchmaking();
    
    res.json({ success: true, queueId: queueRef.id });
  } catch (error) {
    console.error('Error joining queue:', error);
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

// Leave queue
router.delete('/queue', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const queueSnapshot = await db.collection('dungeonQueue')
      .where('userId', '==', userId)
      .limit(1)
      .get();
    
    if (queueSnapshot.empty) {
      return res.status(404).json({ error: 'Not in queue' });
    }
    
    await queueSnapshot.docs[0].ref.delete();
    
    res.json({ success: true, message: 'Left queue' });
  } catch (error) {
    console.error('Error leaving queue:', error);
    res.status(500).json({ error: 'Failed to leave queue' });
  }
});

// Accept group invite
router.post('/group/accept', async (req, res) => {
  try {
    const { userId, groupId } = req.body;
    
    // Group formation logic would go here
    // For now, just acknowledge
    res.json({ success: true, message: 'Group invite accepted' });
  } catch (error) {
    console.error('Error accepting group invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// Matchmaking logic - now uses flexible 2-5 player matching
async function tryMatchmaking() {
  // Use the new flexible matchmaking
  return await tryFlexibleMatchmaking();
}

function estimateWaitTime(roleCounts, userRole) {
  // Simple estimation
  if (userRole === 'tank') return 0; // Tanks are always needed
  if (userRole === 'healer') return roleCounts.tank > 0 ? 30 : 60;
  if (userRole === 'dps') {
    const needed = 3 - (roleCounts.dps || 0);
    if (needed <= 0) return 120; // Too many DPS
    return roleCounts.tank > 0 && roleCounts.healer > 0 ? 30 : 90;
  }
  return 60;
}

// ==================== DUNGEON INSTANCE ENDPOINTS ====================

// Start a new dungeon instance
router.post('/:dungeonId/start', async (req, res) => {
  try {
    const { dungeonId } = req.params;
    const { participants, organizerId } = req.body; // Array of userId strings
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array is required' });
    }
    
    if (!organizerId) {
      return res.status(400).json({ error: 'Organizer ID is required' });
    }
    
    // Import dungeon data
    const { getDungeonById } = await import('../data/dungeons.js');
    const dungeonData = getDungeonById(dungeonId);
    
    if (!dungeonData) {
      return res.status(404).json({ error: 'Dungeon not found' });
    }
    
    // Validate participant count
    if (dungeonData.minPlayers && participants.length < dungeonData.minPlayers) {
      return res.status(400).json({ error: `Minimum ${dungeonData.minPlayers} players required` });
    }
    if (dungeonData.maxPlayers && participants.length > dungeonData.maxPlayers) {
      return res.status(400).json({ error: `Maximum ${dungeonData.maxPlayers} players allowed` });
    }
    
    // Load participant hero data
    const participantData = [];
    for (const heroDocId of participants) {
      const heroDoc = await db.collection('heroes').doc(heroDocId).get();
      if (!heroDoc.exists) {
        return res.status(404).json({ error: `Hero not found: ${heroDocId}` });
      }
      const hero = heroDoc.data();
      const twitchUserId = hero.twitchUserId;
      if (!twitchUserId) {
        return res.status(400).json({ 
          error: `Hero ${heroDocId} is missing twitchUserId field` 
        });
      }
      participantData.push({
        userId: heroDocId, // Hero document ID
        heroId: heroDocId, // Also store as heroId for clarity
        twitchUserId: twitchUserId, // User ID for querying
        username: hero.name || heroDocId,
        heroName: hero.name,
        heroRole: hero.role,
        heroLevel: hero.level || 1,
        currentHp: hero.hp || hero.maxHp,
        maxHp: hero.maxHp,
        isAlive: true,
        deaths: 0
      });
    }
    
    // Extract participant IDs for querying - use twitchUserId (user IDs) not hero document IDs
    // The listener uses participantIds to find instances where the user is a participant
    const participantIds = participantData.map(p => p.twitchUserId).filter(Boolean);
    
    // Create dungeon instance
    const dungeonInstance = {
      dungeonId: dungeonData.id,
      difficulty: dungeonData.difficulty || 'normal',
      status: 'active',
      organizerId,
      participants: participantData,
      participantIds: participantIds, // For efficient querying
      currentRoom: 0,
      maxRooms: dungeonData.rooms.length,
      rooms: dungeonData.rooms,
      combatLog: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const instanceRef = await db.collection('dungeonInstances').add(dungeonInstance);
    
    res.json({
      success: true,
      instanceId: instanceRef.id,
      dungeon: dungeonData,
      participants: participantData
    });
  } catch (error) {
    console.error('Error starting dungeon:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to start dungeon',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get dungeon instance
router.get('/instance/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    
    const instanceDoc = await db.collection('dungeonInstances').doc(instanceId).get();
    
    if (!instanceDoc.exists) {
      return res.status(404).json({ error: 'Dungeon instance not found' });
    }
    
    const instance = { id: instanceDoc.id, ...instanceDoc.data() };
    res.json(instance);
  } catch (error) {
    console.error('Error fetching dungeon instance:', error);
    res.status(500).json({ error: 'Failed to fetch dungeon instance' });
  }
});

// Update dungeon progress (room completed)
router.post('/instance/:instanceId/progress', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { room, participants, combatLogEntries } = req.body;
    
    const instanceRef = db.collection('dungeonInstances').doc(instanceId);
    const doc = await instanceRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Dungeon instance not found' });
    }
    
    const instance = doc.data();
    
    if (instance.status === 'completed' || instance.status === 'failed') {
      return res.status(400).json({ error: 'Dungeon instance is already finished' });
    }
    
    // Extract participant IDs from updated participants
    const updatedParticipantIds = participants ? participants.map(p => p.userId) : instance.participantIds || [];
    
    // Build update data
    const updateData = {
      participantIds: updatedParticipantIds, // Maintain participantIds array
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Only update room if provided
    if (room !== undefined) {
      updateData.currentRoom = room;
      updateData.status = room >= instance.maxRooms ? 'in-progress' : 'active';
    }
    
    // Only update participants if provided
    if (participants && Array.isArray(participants)) {
      updateData.participants = participants;
    }
    
    // Only update combat log if entries are provided and is an array
    if (combatLogEntries && Array.isArray(combatLogEntries) && combatLogEntries.length > 0) {
      updateData.combatLog = admin.firestore.FieldValue.arrayUnion(...combatLogEntries);
    }
    
    // Update instance
    await instanceRef.update(updateData);
    
    res.json({
      success: true,
      message: `Room ${room} completed`,
      isBossFight: room >= instance.maxRooms
    });
  } catch (error) {
    console.error('Error updating dungeon progress:', error);
    res.status(500).json({ error: 'Failed to update dungeon progress' });
  }
});

// Complete dungeon and distribute loot
router.post('/instance/:instanceId/complete', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { success, finalParticipants, participants, finalCombatLog, combatLog } = req.body;
    
    // Support both finalParticipants and participants field names
    const participantsData = finalParticipants || participants || [];
    
    const instanceRef = db.collection('dungeonInstances').doc(instanceId);
    const doc = await instanceRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Dungeon instance not found' });
    }
    
    const instance = doc.data();
    
    if (instance.status === 'completed' || instance.status === 'failed') {
      return res.status(400).json({ error: 'Dungeon instance is already finished' });
    }
    
    // Import dungeon data
    const { getDungeonById } = await import('../data/dungeons.js');
    const dungeonData = getDungeonById(instance.dungeonId);
    
    if (!success) {
      // Dungeon failed
      // Maintain participantIds using twitchUserId if available, fallback to userId
      const updatedParticipantIds = participantsData.map(p => p.twitchUserId || p.userId).filter(Boolean);
      
      await instanceRef.update({
        status: 'failed',
        participants: participantsData,
        participantIds: updatedParticipantIds.length > 0 ? updatedParticipantIds : instance.participantIds,
        combatLog: finalCombatLog || combatLog || instance.combatLog || [],
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return res.json({
        success: false,
        message: 'Dungeon failed',
        rewards: null
      });
    }
    
    // Dungeon succeeded - distribute rewards
    const rewards = dungeonData.rewards || { gold: 0, tokens: 0, experience: 0 };
    
    // Update instance as completed
    // Maintain participantIds using twitchUserId if available, fallback to userId
    const updatedParticipantIds = participantsData.map(p => p.twitchUserId || p.userId).filter(Boolean);
    
    await instanceRef.update({
      status: 'completed',
      participants: participantsData,
      participantIds: updatedParticipantIds.length > 0 ? updatedParticipantIds : instance.participantIds,
      combatLog: finalCombatLog || combatLog || instance.combatLog || [],
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Reset party status back to 'forming' for all parties that were in this instance
    try {
      const partyIds = new Set();
      
      // Check parties collection for any party with members in this instance
      for (const participantId of updatedParticipantIds) {
        const partySnapshot = await db.collection('parties')
          .where('members', 'array-contains', participantId)
          .where('status', '==', 'in_instance')
          .get();
        
        partySnapshot.docs.forEach(doc => {
          partyIds.add(doc.id);
        });
      }
      
      // Reset all parties back to 'forming'
      const resetPromises = Array.from(partyIds).map(async (partyId) => {
        try {
          const partyRef = db.collection('parties').doc(partyId);
          await partyRef.update({
            status: 'forming',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[Dungeon] ✅ Reset party ${partyId} status to 'forming' after dungeon completion`);
        } catch (error) {
          console.error(`[Dungeon] Failed to reset party ${partyId}:`, error);
        }
      });
      
      await Promise.all(resetPromises);
    } catch (error) {
      console.error('[Dungeon] Error resetting party statuses:', error);
      // Don't fail the request if party reset fails
    }
    
    // Distribute rewards to participants
    const rewardPromises = participantsData.map(async (participant) => {
      if (!participant.isAlive && participant.deaths > 2) {
        return; // Dead players get no rewards
      }
      
      const heroDoc = await db.collection('heroes').doc(participant.userId).get();
      
      if (heroDoc.exists) {
        const heroRef = heroDoc.ref;
        const hero = heroDoc.data();
        
        // Add gold, tokens, and XP
        await heroRef.update({
          gold: (hero.gold || 0) + rewards.gold,
          tokens: (hero.tokens || 0) + rewards.tokens,
          xp: (hero.xp || 0) + rewards.experience,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });
    
    await Promise.all(rewardPromises);
    
    res.json({
      success: true,
      message: 'Dungeon completed successfully!',
      rewards: {
        gold: rewards.gold,
        tokens: rewards.tokens,
        experience: rewards.experience
      }
    });
  } catch (error) {
    console.error('Error completing dungeon:', error);
    res.status(500).json({ error: 'Failed to complete dungeon' });
  }
});

// Get available dungeons for a user
router.get('/available/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Try to get hero by document ID first
    let heroDoc = await db.collection('heroes').doc(userId).get();
    let hero = heroDoc.exists ? heroDoc.data() : null;
    
    // If not found by document ID, try to find by Twitch user ID
    if (!heroDoc.exists) {
      const snapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .get();
      
      if (!snapshot.empty) {
        let heroes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        heroes.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() ?? new Date(a.updatedAt ?? 0).getTime();
          const bTime = b.updatedAt?.toMillis?.() ?? new Date(b.updatedAt ?? 0).getTime();
          return bTime - aTime;
        });
        hero = heroes[0];
      }
    }
    
    if (!hero) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const heroLevel = hero.level || 1;
    
    // Calculate item score
    let itemScore = 0;
    if (hero.equipment) {
      Object.values(hero.equipment).forEach(item => {
        if (item) {
          const baseScore = (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
          const rarityBonus = item.rarity === 'legendary' ? 1.5 : 
                              item.rarity === 'epic' ? 1.3 : 
                              item.rarity === 'rare' ? 1.1 : 1.0;
          const procBonus = (item.procEffects?.length || 0) * 50;
          itemScore += Math.floor((baseScore * rarityBonus) + procBonus);
        }
      });
    }
    
    // Import dungeon data
    const { getAllDungeons, getDungeonById } = await import('../data/dungeons.js');
    const allDungeons = getAllDungeons();
    
    // LAUNCH: Only return Goblin Cave for now (we'll add more after launch)
    const launchDungeonId = 'goblin_cave';
    const launchDungeon = getDungeonById(launchDungeonId);
    
    // Filter by level and item score requirements
    let availableDungeons = [];
    if (launchDungeon) {
      const meetsLevel = !launchDungeon.minLevel || heroLevel >= launchDungeon.minLevel;
      const meetsItemScore = !launchDungeon.minItemScore || itemScore >= launchDungeon.minItemScore;
      
      if (meetsLevel && meetsItemScore) {
        availableDungeons = [launchDungeon];
      }
    }
    
    // TODO: After launch, uncomment this to show all available dungeons:
    // const availableDungeons = allDungeons.filter(dungeon => {
    //   if (dungeon.minLevel && heroLevel < dungeon.minLevel) return false;
    //   if (dungeon.minItemScore && itemScore < dungeon.minItemScore) return false;
    //   return true;
    // });
    
    res.json({
      heroLevel,
      itemScore,
      availableDungeons
    });
  } catch (error) {
    console.error('Error fetching available dungeons:', error);
    res.status(500).json({ error: 'Failed to fetch available dungeons' });
  }
});

// Get all dungeons (for display - shows all with availability flag)
router.get('/', async (req, res) => {
  try {
    const { getAllDungeons } = await import('../data/dungeons.js');
    const allDungeons = getAllDungeons();
    
    // LAUNCH: Only Goblin Cave is available for launch
    const launchDungeonId = 'goblin_cave';
    
    const dungeons = allDungeons.map(dungeon => ({
      id: dungeon.id,
      name: dungeon.name,
      type: dungeon.type,
      difficulty: dungeon.difficulty,
      minLevel: dungeon.minLevel,
      minItemScore: dungeon.minItemScore,
      description: dungeon.description,
      estimatedDuration: dungeon.estimatedDuration,
      rewards: dungeon.rewards,
      rooms: dungeon.rooms?.length || 0,
      available: dungeon.id === launchDungeonId // Only Goblin Cave is available
    }));
    
    res.json(dungeons);
  } catch (error) {
    console.error('Error fetching dungeons:', error);
    res.status(500).json({ error: 'Failed to fetch dungeons' });
  }
});

export default router;
