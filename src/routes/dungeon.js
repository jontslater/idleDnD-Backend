import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Get all dungeons
router.get('/', async (req, res) => {
  try {
    const { getAllDungeons } = await import('../data/dungeons.js');
    const allDungeons = getAllDungeons();
    res.json(allDungeons);
  } catch (error) {
    console.error('Error getting all dungeons:', error);
    res.status(500).json({ error: 'Failed to get dungeons' });
  }
});

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
    const { userId, heroId, role, itemScore, dungeonType = 'normal' } = req.body;
    
    if (!userId || !heroId || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const validRoles = ['tank', 'healer', 'dps'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
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
      role,
      itemScore: itemScore || 0,
      dungeonType,
      queuedAt: admin.firestore.Timestamp.now(),
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

// Matchmaking logic
// STRICT REQUIREMENT: Only forms groups with EXACTLY 1 tank, 1 healer, 3 DPS
async function tryMatchmaking() {
  try {
    const queueSnapshot = await db.collection('dungeonQueue').get();
    const queue = queueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Group: EXACTLY 1 tank, 1 healer, 3 DPS (no partial groups allowed)
    const tanks = queue.filter(q => q.role === 'tank');
    const healers = queue.filter(q => q.role === 'healer');
    const dps = queue.filter(q => q.role === 'dps');
    
    console.log(`[Matchmaking] Queue status: ${tanks.length} tank(s), ${healers.length} healer(s), ${dps.length} DPS`);
    
    // Try to form groups - STRICT: Must have exactly 1 tank, 1 healer, and 3 DPS
    // Will NOT form groups with different makeup (e.g., 2 tanks, 2 healers, etc.)
    let groupsFormed = 0;
    while (tanks.length >= 1 && healers.length >= 1 && dps.length >= 3) {
      const group = {
        tank: tanks.shift(),
        healer: healers.shift(),
        dps: [dps.shift(), dps.shift(), dps.shift()]
      };
      
      // Remove from queue FIRST (before creating instance) - use Promise.all for better performance
      const idsToRemove = [
        group.tank.id,
        group.healer.id,
        ...group.dps.map(d => d.id)
      ];
      
      const deletePromises = idsToRemove.map(id => db.collection('dungeonQueue').doc(id).delete());
      await Promise.all(deletePromises);
      
      groupsFormed++;
      
      // Log group formation
      console.log(`[Matchmaking] ✅ Group ${groupsFormed} formed: 1 Tank (${group.tank.userId}), 1 Healer (${group.healer.userId}), 3 DPS (${group.dps.map(d => d.userId).join(', ')})`);
      
      // Create dungeon instance for the group (this will also update heroes with activeInstance)
      try {
        await createDungeonInstanceForGroup(group);
      } catch (error) {
        console.error(`[Matchmaking] ❌ Failed to create dungeon instance for group ${groupsFormed}:`, error);
        // Continue - don't block other group formations
      }
    }
    
    if (groupsFormed === 0 && queue.length > 0) {
      console.log(`[Matchmaking] ⏳ Waiting for complete group makeup: Need ${1 - tanks.length} tank(s), ${1 - healers.length} healer(s), ${Math.max(0, 3 - dps.length)} DPS`);
    }
    
    return groupsFormed;
  } catch (error) {
    console.error('[Matchmaking] Error in matchmaking:', error);
    return 0;
  }
}

// Helper function to create dungeon instance from a matched group
// Group can be: { tank, healer, dps: [...] } OR { members: [...], partyId, dungeonId, dungeonType } for parties
async function createDungeonInstanceForGroup(group, dungeonDataOverride = null) {
  try {
    let selectedDungeon = dungeonDataOverride;
    let participantHeroIds = [];
    let dungeonType = 'normal';
    
    // Handle party format: { members: [...], partyId, dungeonId, dungeonType }
    if (group.members && Array.isArray(group.members)) {
      participantHeroIds = group.members.map(m => m.heroId);
      dungeonType = group.dungeonType || group.members[0]?.dungeonType || 'normal';
      
      // Use provided dungeonDataOverride or find by dungeonId
      if (!selectedDungeon && group.dungeonId) {
        const { getDungeonById } = await import('../data/dungeons.js');
        selectedDungeon = getDungeonById(group.dungeonId);
      }
      
      // Fallback to finding a suitable dungeon
      if (!selectedDungeon) {
        const { getAllDungeons } = await import('../data/dungeons.js');
        const allDungeons = getAllDungeons();
        selectedDungeon = allDungeons.find(d => 
          d.type === 'group' && 
          d.difficulty === dungeonType &&
          d.minPlayers <= participantHeroIds.length &&
          d.maxPlayers >= participantHeroIds.length
        ) || allDungeons.find(d => d.type === 'group');
      }
    } else {
      // Handle matchmaking format: { tank, healer, dps: [...] }
      dungeonType = group.tank.dungeonType || group.healer.dungeonType || group.dps[0]?.dungeonType || 'normal';
      
      // Import dungeon data
      const { getAllDungeons } = await import('../data/dungeons.js');
      const allDungeons = getAllDungeons();
      
      // Find an appropriate group dungeon (type: 'group') that matches difficulty
      // Default to 'ancient_catacombs' for normal, or find one matching difficulty
      selectedDungeon = allDungeons.find(d => 
        d.type === 'group' && 
        d.difficulty === dungeonType &&
        d.minPlayers <= 5 &&
        d.maxPlayers >= 5
      );
      
      // Fallback to ancient_catacombs if no match
      if (!selectedDungeon) {
        const { getDungeonById } = await import('../data/dungeons.js');
        selectedDungeon = getDungeonById('ancient_catacombs') || allDungeons.find(d => d.type === 'group');
      }
      
      // Collect all participant hero IDs from the group
      participantHeroIds = [
        group.tank.heroId,
        group.healer.heroId,
        ...group.dps.map(d => d.heroId)
      ];
    }
    
    if (!selectedDungeon) {
      throw new Error('No suitable dungeon found for group');
    }
    
    // Load participant hero data
    const participantData = [];
    for (const heroDocId of participantHeroIds) {
      const heroDoc = await db.collection('heroes').doc(heroDocId).get();
      if (!heroDoc.exists) {
        console.warn(`[Matchmaking] Hero not found: ${heroDocId}, skipping...`);
        continue;
      }
      const hero = heroDoc.data();
      const twitchUserId = hero.twitchUserId || heroDocId; // Fallback to heroId if no twitchUserId
      
      participantData.push({
        userId: heroDocId,
        heroId: heroDocId,
        twitchUserId: twitchUserId,
        username: hero.name || heroDocId,
        heroName: hero.name,
        heroRole: hero.role,
        heroLevel: hero.level || 1,
        currentHp: hero.hp || hero.maxHp || 100,
        maxHp: hero.maxHp || 100,
        isAlive: true,
        deaths: 0
      });
    }
    
    // For matchmaking groups, expect exactly 5. For parties, allow variable sizes
    if (!group.members && participantData.length !== 5) {
      throw new Error(`Expected 5 participants but got ${participantData.length}`);
    }
    
    // Extract participant IDs for querying
    const participantIds = participantData.map(p => p.twitchUserId).filter(Boolean);
    
    // Use first participant as organizer (tank for matchmaking, first member for parties)
    const organizerId = group.members ? group.members[0]?.userId : group.tank.userId;
    
    // Create dungeon instance
    const dungeonInstance = {
      dungeonId: selectedDungeon.id,
      difficulty: selectedDungeon.difficulty || 'normal',
      status: 'active',
      organizerId,
      participants: participantData,
      participantIds: participantIds,
      currentRoom: 0,
      maxRooms: selectedDungeon.rooms.length,
      rooms: selectedDungeon.rooms,
      combatLog: [],
      partyId: group.partyId || null, // Store partyId if this is a party dungeon
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const instanceRef = await db.collection('dungeonInstances').add(dungeonInstance);
    
    console.log(`[Matchmaking] 🏰 Created dungeon instance ${instanceRef.id} for group: ${selectedDungeon.name} (${dungeonType} difficulty)`);
    
    // Update all heroes to have activeInstance pointing to this dungeon
    // This will trigger the frontend to switch to dungeon mode
    const updatePromises = participantHeroIds.map(async (heroId) => {
      try {
        await db.collection('heroes').doc(heroId).update({
          activeInstance: {
            type: 'dungeon',
            instanceId: instanceRef.id
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error(`[Matchmaking] Failed to update hero ${heroId} with active instance:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`[Matchmaking] ✅ Updated all ${participantData.length} heroes with active dungeon instance`);
    
    return instanceRef.id;
  } catch (error) {
    console.error('[Matchmaking] Error creating dungeon instance:', error);
    throw error;
  }
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
    
    // Cleanup: Clear dungeon queue entries and reset party status
    try {
      // Clear activeInstance and currentBattlefieldId from all participants' heroes
      // This prevents dungeon participants from appearing in idle adventure after leaving
      const cleanupHeroPromises = participantsData.map(async (participant) => {
        try {
          const heroDoc = await db.collection('heroes').doc(participant.userId).get();
          if (heroDoc.exists) {
            await heroDoc.ref.update({
              activeInstance: admin.firestore.FieldValue.delete(),
              currentBattlefieldId: admin.firestore.FieldValue.delete(),
              currentBattlefieldType: admin.firestore.FieldValue.delete(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Dungeon Complete] Cleared activeInstance and currentBattlefieldId for hero ${participant.userId}`);
          }
        } catch (error) {
          console.error(`[Dungeon Complete] Failed to clear activeInstance/currentBattlefieldId for hero ${participant.userId}:`, error);
        }
      });
      
      // Clear dungeon queue entries for all participants
      const userIds = participantsData.map(p => p.twitchUserId || p.userId).filter(Boolean);
      const queueCleanupPromises = userIds.map(async (userId) => {
        try {
          const queueSnapshot = await db.collection('dungeonQueue')
            .where('userId', '==', userId)
            .get();
          
          const deletePromises = queueSnapshot.docs.map(doc => doc.ref.delete());
          await Promise.all(deletePromises);
          
          if (queueSnapshot.docs.length > 0) {
            console.log(`[Dungeon Complete] Cleared ${queueSnapshot.docs.length} queue entries for user ${userId}`);
          }
        } catch (error) {
          console.error(`[Dungeon Complete] Failed to clear queue entries for user ${userId}:`, error);
        }
      });
      
      // Reset party status if this is a party dungeon (partyId is now stored in instance)
      const partyId = instance.partyId;
      
      if (partyId) {
        try {
          const partyRef = db.collection('parties').doc(partyId);
          const partyDoc = await partyRef.get();
          
          if (partyDoc.exists) {
            const partyData = partyDoc.data();
            // Only reset if party is still in instance (might have been cancelled already)
            if (partyData.status === 'in_instance') {
              await partyRef.update({
                status: 'forming',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
              console.log(`[Dungeon Complete] Reset party ${partyId} status from in_instance to forming`);
            }
          }
        } catch (error) {
          console.error(`[Dungeon Complete] Failed to reset party ${partyId} status:`, error);
        }
      }
      
      await Promise.all([...cleanupHeroPromises, ...queueCleanupPromises]);
    } catch (cleanupError) {
      console.error('[Dungeon Complete] Error during cleanup:', cleanupError);
      // Don't fail the request if cleanup fails
    }
    
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

// Get dungeon definition by ID (returns static data)
router.get('/:dungeonId', async (req, res) => {
  try {
    const { dungeonId } = req.params;
    const { getDungeonById } = await import('../data/dungeons.js');
    const dungeon = getDungeonById(dungeonId);
    
    if (!dungeon) {
      return res.status(404).json({ error: 'Dungeon not found' });
    }
    
    res.json(dungeon);
  } catch (error) {
    console.error('Error fetching dungeon definition:', error);
    res.status(500).json({ error: 'Failed to fetch dungeon definition' });
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
    const { getAllDungeons } = await import('../data/dungeons.js');
    const allDungeons = getAllDungeons();
    
    // Filter dungeons by level and item score requirements
    const availableDungeons = allDungeons.filter(dungeon => {
      if (dungeon.minLevel && heroLevel < dungeon.minLevel) return false;
      if (dungeon.minItemScore && itemScore < dungeon.minItemScore) return false;
      return true;
    });
    
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

export { tryMatchmaking, createDungeonInstanceForGroup };
export default router;
