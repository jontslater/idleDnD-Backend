import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Get all raids
router.get('/', async (req, res) => {
  try {
    console.log('[Raids API] GET /api/raids - query:', req.query);
    const { type, status } = req.query;
    let query = db.collection('raids');
    
    if (type) {
      query = query.where('type', '==', type);
    }
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    const snapshot = await query.get();
    const raids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`[Raids API] Returning ${raids.length} raid(s):`, raids.map(r => ({ id: r.id, name: r.name })));
    
    res.json(raids);
  } catch (error) {
    console.error('Error fetching raids:', error);
    res.status(500).json({ error: 'Failed to fetch raids' });
  }
});

// Create test raid instance (for testing) - MUST be before /:raidId route
router.post('/test-instance', async (req, res) => {
  try {
    const { organizerId, raidId } = req.body;
    
    if (!organizerId) {
      return res.status(400).json({ error: 'organizerId is required' });
    }
    
    // Import raid data
    const { getRaidById } = await import('../data/raids.js');
    const testRaidId = raidId || 'corrupted_temple'; // Default to corrupted temple
    const raidData = getRaidById(testRaidId);
    
    if (!raidData) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    // Create test participants (you can modify these)
    const testParticipants = [
      { userId: organizerId, username: 'TestOrganizer', heroName: 'TestOrganizer', heroLevel: 50, heroRole: 'guardian', itemScore: 200, isAlive: true },
      { userId: 'test-user-2', username: 'TestUser2', heroName: 'TestUser2', heroLevel: 50, heroRole: 'berserker', itemScore: 200, isAlive: true },
      { userId: 'test-user-3', username: 'TestUser3', heroName: 'TestUser3', heroLevel: 50, heroRole: 'cleric', itemScore: 200, isAlive: true },
      { userId: 'test-user-4', username: 'TestUser4', heroName: 'TestUser4', heroLevel: 50, heroRole: 'mage', itemScore: 200, isAlive: true },
      { userId: 'test-user-5', username: 'TestUser5', heroName: 'TestUser5', heroLevel: 50, heroRole: 'ranger', itemScore: 200, isAlive: true },
    ];
    
    // Extract participant IDs for querying
    const participantIds = testParticipants.map(p => p.userId);
    
    // Create raid instance
    const raidInstance = {
      raidId: raidData.id,
      difficulty: raidData.difficulty,
      status: 'active', // Start as active for testing
      organizerId: organizerId,
      currentWave: 1,
      maxWaves: raidData.waves,
      bossHp: raidData.boss.hp,
      bossMaxHp: raidData.boss.hp,
      participants: testParticipants.map(p => ({
        ...p,
        damageDealt: 0,
        healingDone: 0,
        damageTaken: 0,
        deaths: 0,
        currentHp: 5000, // Test HP
        maxHp: 5000
      })),
      participantIds: participantIds, // Array of userId strings for querying
      combatLog: [{
        timestamp: Date.now(),
        message: `Test raid started: ${raidData.name}`,
        type: 'phase'
      }],
      lootDrops: [],
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const instanceRef = await db.collection('raidInstances').add(raidInstance);
    
    res.json({
      success: true,
      instanceId: instanceRef.id,
      message: 'Test raid instance created',
      instance: { id: instanceRef.id, ...raidInstance }
    });
  } catch (error) {
    console.error('Error creating test raid instance:', error);
    res.status(500).json({ error: 'Failed to create test raid instance' });
  }
});

// Get upcoming scheduled raids (next 24 hours) - MUST come before /:raidId route
router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    // Query only by status (doesn't require composite index)
    // Filter by startedAt and sort in memory to avoid index requirement
    const snapshot = await db.collection('raidInstances')
      .where('status', '==', 'scheduled')
      .get();
    
    // Filter by date range in memory (avoids needing composite index)
    const scheduledRaids = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(raid => {
        const startedAt = raid.startedAt?.toDate ? raid.startedAt.toDate() : 
                         raid.startedAt ? new Date(raid.startedAt) : null;
        if (!startedAt) return false;
        return startedAt >= now && startedAt <= next24Hours;
      })
      .sort((a, b) => {
        const aTime = a.startedAt?.toDate ? a.startedAt.toDate().getTime() : 
                     a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const bTime = b.startedAt?.toDate ? b.startedAt.toDate().getTime() : 
                     b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return aTime - bTime;
      });
    
    res.json({ scheduledRaids });
  } catch (error) {
    // If the query still fails (e.g., missing index on startedAt), return empty array
    if (error.code === 9) {
      console.warn('⚠️ Firestore index missing for upcoming raids query. Returning empty array. Create index at:', error.details);
      return res.json({ scheduledRaids: [] });
    }
    console.error('Error fetching upcoming raids:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming raids' });
  }
});

// Get raid by ID
router.get('/:raidId', async (req, res) => {
  try {
    const doc = await db.collection('raids').doc(req.params.raidId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching raid:', error);
    res.status(500).json({ error: 'Failed to fetch raid' });
  }
});

// Sign up for raid
router.post('/:raidId/signup', async (req, res) => {
  try {
    const { guildId, participants } = req.body;
    const raidRef = db.collection('raids').doc(req.params.raidId);
    const doc = await raidRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    const raid = doc.data();
    
    // Check if raid is full
    const currentParticipants = raid.signups?.reduce((sum, signup) => 
      sum + signup.participants.length, 0) || 0;
    
    if (currentParticipants + participants.length > raid.maxParticipants) {
      return res.status(400).json({ error: 'Raid is full' });
    }
    
    const signup = {
      guildId,
      participants,
      signedUpAt: new Date().toISOString()
    };
    
    await raidRef.update({
      signups: admin.firestore.FieldValue.arrayUnion(signup),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Signed up for raid successfully' });
  } catch (error) {
    console.error('Error signing up for raid:', error);
    res.status(500).json({ error: 'Failed to sign up for raid' });
  }
});

// Get current world boss - mount on main router, not nested
// This will be accessible at /api/raids/worldboss/current

// Sign up for world boss
router.post('/worldboss/signup', async (req, res) => {
  try {
    const { userId, username, heroLevel, heroRole } = req.body;
    
    // Get current world boss
    const snapshot = await db.collection('worldBoss')
      .where('status', '==', 'upcoming')
      .orderBy('scheduledTime', 'asc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return res.status(404).json({ error: 'No upcoming world boss' });
    }
    
    const doc = snapshot.docs[0];
    const participant = {
      userId,
      username,
      heroLevel,
      heroRole,
      damageDealt: 0,
      healingDone: 0
    };
    
    // Get current participantIds to update
    const currentData = doc.data();
    const currentParticipantIds = currentData.participantIds || [];
    const updatedParticipantIds = currentParticipantIds.includes(userId) 
      ? currentParticipantIds 
      : [...currentParticipantIds, userId];
    
    await doc.ref.update({
      participants: admin.firestore.FieldValue.arrayUnion(participant),
      participantIds: updatedParticipantIds, // Maintain participantIds array
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Signed up for world boss successfully' });
  } catch (error) {
    console.error('Error signing up for world boss:', error);
    res.status(500).json({ error: 'Failed to sign up for world boss' });
  }
});

// ==================== RAID INSTANCE ENDPOINTS ====================

// Get available raids for a user based on their level and item score
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
        // Get the most recently updated hero
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
    
    // Get raids from Firebase (not hardcoded data)
    const raidsSnapshot = await db.collection('raids').get();
    const allRaids = raidsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`[Raids API] Available raids for hero Lv${heroLevel}, iScore ${itemScore}: ${allRaids.length} raid(s)`);
    
    res.json({
      heroLevel,
      itemScore,
      availableRaids: allRaids
    });
  } catch (error) {
    console.error('❌ Error fetching available raids:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ error: 'Failed to fetch available raids', details: error.message });
  }
});

// Start a new raid instance
router.post('/:raidId/start', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { participants, organizerId } = req.body; // Array of userId strings
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array is required' });
    }
    
    if (!organizerId) {
      return res.status(400).json({ error: 'Organizer ID is required' });
    }
    
    // Import raid data
    const { getRaidById } = await import('../data/raids.js');
    const raidData = getRaidById(raidId);
    
    if (!raidData) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    // Validate participant count
    if (participants.length < raidData.minPlayers || participants.length > raidData.maxPlayers) {
      return res.status(400).json({ 
        error: `Raid requires ${raidData.minPlayers}-${raidData.maxPlayers} players` 
      });
    }
    
    // Fetch all participant heroes
    console.log(`[Raid Start] Fetching heroes for participants:`, participants);
    const heroPromises = participants.map(heroDocId => 
      db.collection('heroes').doc(heroDocId).get()
    );
    
    const heroDocs = await Promise.all(heroPromises);
    const participantData = [];
    
    for (let i = 0; i < heroDocs.length; i++) {
      const heroDoc = heroDocs[i];
      if (!heroDoc || !heroDoc.exists) {
        console.error(`[Raid Start] Hero not found for participant ${i}:`, participants[i]);
        return res.status(404).json({ error: `Hero not found: ${participants[i]}` });
      }
      
      const hero = heroDoc.data();
      // Get document ID - try multiple methods as fallback
      const heroDocId = heroDoc.id || heroDoc.ref?.id || participants[i];
      
      console.log(`[Raid Start] Processing hero ${i}:`, {
        inputParticipantId: participants[i],
        heroDocId: heroDocId,
        heroDocIdType: typeof heroDocId,
        heroDocHasId: !!heroDoc.id,
        heroDocRefId: heroDoc.ref?.id,
        heroName: hero?.name,
        twitchUserId: hero?.twitchUserId
      });
      
      // Validate heroDocId is set
      if (!heroDocId) {
        console.error(`[Raid Start] Hero document ID is undefined for participant ${i}:`, {
          participants: participants[i],
          heroDoc: {
            exists: heroDoc.exists,
            id: heroDoc.id,
            ref: heroDoc.ref?.path
          }
        });
        return res.status(500).json({ 
          error: `Invalid hero document ID for participant ${i}` 
        });
      }
      
      // Get user ID (twitchUserId) - required for participantIds query
      const twitchUserId = hero.twitchUserId;
      if (!twitchUserId) {
        return res.status(400).json({ 
          error: `Hero ${heroDocId} is missing twitchUserId field` 
        });
      }
      
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
      
      // Check if hero meets requirements
      if (hero.level < raidData.minLevel || itemScore < raidData.minItemScore) {
        return res.status(400).json({ 
          error: `${hero.name} does not meet raid requirements (Level ${raidData.minLevel}, ${raidData.minItemScore} item score)` 
        });
      }
      
      // Double-check heroDocId is still valid before creating participant
      if (!heroDocId || heroDocId === undefined) {
        console.error(`[Raid Start] heroDocId became undefined before creating participant ${i}!`, {
          originalHeroDocId: heroDoc.id,
          participantsInput: participants[i],
          hero: { name: hero.name, twitchUserId: hero.twitchUserId }
        });
        return res.status(500).json({ 
          error: `Hero document ID is invalid for participant ${i}` 
        });
      }
      
      // Ensure all required fields are set
      const participant = {
        userId: String(heroDocId), // Hero document ID - must be set, ensure it's a string
        heroId: heroDocId, // Also store as heroId for clarity
        username: hero.name || `Hero${i}`,
        heroName: hero.name || `Hero${i}`,
        heroLevel: hero.level || 1,
        heroRole: hero.role || 'warrior',
        itemScore: itemScore,
        damageDealt: 0,
        healingDone: 0,
        damageTaken: 0,
        deaths: 0,
        isAlive: true,
        twitchUserId: twitchUserId // Store user ID for querying
      };
      
      // Validate required fields
      if (!participant.userId) {
        console.error(`[Raid Start] participant.userId is undefined for participant ${i}:`, {
          heroDocId,
          participantId: participants[i],
          hero: hero ? { name: hero.name, twitchUserId: hero.twitchUserId } : null
        });
        return res.status(500).json({ 
          error: `Failed to set userId for participant ${i}` 
        });
      }
      
      console.log(`[Raid Start] Created participant ${i}:`, {
        userId: participant.userId,
        username: participant.username,
        twitchUserId: participant.twitchUserId
      });
      
      participantData.push(participant);
    }
    
    // Extract participant IDs for querying - use twitchUserId (user IDs) not hero document IDs
    // The listener uses participantIds to find instances where the user is a participant
    const participantIds = participantData.map(p => p.twitchUserId).filter(Boolean);
    
    // Final validation: Ensure all participants have userId set
    for (let i = 0; i < participantData.length; i++) {
      if (!participantData[i].userId) {
        console.error(`[Raid Start] CRITICAL: participantData[${i}].userId is undefined!`, {
          participant: participantData[i],
          originalParticipantId: participants[i]
        });
        return res.status(500).json({ 
          error: `Invalid participant data: userId is undefined for participant ${i}` 
        });
      }
    }
    
    console.log(`[Raid Start] All participants validated. Total: ${participantData.length}`, 
      participantData.map(p => ({ userId: p.userId, username: p.username })));
    
    // Create raid instance
    const raidInstance = {
      raidId: raidData.id,
      difficulty: raidData.difficulty,
      status: 'starting',
      organizerId: organizerId, // Instance owner/organizer
      currentWave: 0,
      maxWaves: raidData.waves,
      bossHp: raidData.boss.hp,
      bossMaxHp: raidData.boss.hp,
      participants: participantData,
      participantIds: participantIds, // Array of userId strings for querying
      combatLog: [{
        timestamp: Date.now(),
        message: `Raid started: ${raidData.name}`,
        type: 'phase'
      }],
      lootDrops: [],
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const instanceRef = await db.collection('raidInstances').add(raidInstance);
    
    res.json({
      success: true,
      instanceId: instanceRef.id,
      raidData: raidData,
      message: `Raid instance created successfully`
    });
  } catch (error) {
    console.error('Error starting raid:', error);
    res.status(500).json({ error: 'Failed to start raid' });
  }
});

// Update raid progress (wave completed)
router.post('/instance/:instanceId/progress', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { wave, participants, combatLogEntries, bossHpPercent, currentPhase } = req.body;
    
    const instanceRef = db.collection('raidInstances').doc(instanceId);
    const doc = await instanceRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    const instance = doc.data();
    
    if (instance.status === 'completed' || instance.status === 'failed') {
      return res.status(400).json({ error: 'Raid instance is already finished' });
    }
    
    // Use provided participants or fallback to existing ones
    const participantsToUse = participants || instance.participants || [];
    
    // Validate participants array
    if (!Array.isArray(participantsToUse)) {
      console.error('Invalid participants:', participantsToUse);
      return res.status(400).json({ error: 'Participants must be an array' });
    }
    
    // Extract participant IDs from updated participants
    // Use twitchUserId if available (for querying), fallback to userId
    const updatedParticipantIds = participantsToUse.map(p => {
      if (!p || typeof p !== 'object') {
        console.error('Invalid participant object:', p);
        return null;
      }
      return p.twitchUserId || p.userId;
    }).filter(Boolean);
    
    // Ensure we have participantIds (fallback to existing if empty)
    if (updatedParticipantIds.length === 0 && instance.participantIds) {
      console.warn('No participantIds extracted, using existing:', instance.participantIds);
    }
    
    // Create checkpoint if phase changed or boss HP is significant
    // Note: Checkpoints should not contain Firestore FieldValue objects, so we'll set timestamp on save
    const checkpoint = {
      wave: wave || 0,
      participants: participantsToUse || [],
      bossHpPercent: bossHpPercent !== undefined ? bossHpPercent : null,
      currentPhase: currentPhase || null,
      timestamp: Date.now() // Use timestamp instead of serverTimestamp for checkpoint
    };
    
    // Validate checkpoint has at least some data
    const hasValidCheckpoint = checkpoint.wave !== undefined && 
                                checkpoint.participants && 
                                Array.isArray(checkpoint.participants);
    
    // Update instance
    const updateData = {
      currentWave: wave,
      participants: participantsToUse,
      participantIds: updatedParticipantIds.length > 0 ? updatedParticipantIds : instance.participantIds, // Maintain participantIds array
      status: wave >= instance.maxWaves ? 'in-progress' : 'in-progress',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Only add to combat log if there are entries
    if (combatLogEntries && combatLogEntries.length > 0) {
      updateData.combatLog = admin.firestore.FieldValue.arrayUnion(...combatLogEntries);
    }
    
    // Update bossHp if bossHpPercent is provided
    if (bossHpPercent !== undefined && bossHpPercent !== null) {
      const bossMaxHp = instance.bossMaxHp || instance.boss?.maxHp || instance.boss?.hp || 1000;
      updateData.bossHp = Math.floor((bossHpPercent / 100) * bossMaxHp);
    }
    
    // Save checkpoint if phase changed or at significant HP thresholds
    // Only save checkpoint if it's valid
    if (hasValidCheckpoint) {
      try {
        if (currentPhase !== undefined && currentPhase !== instance.lastCheckpoint?.currentPhase) {
          updateData.lastCheckpoint = checkpoint;
          updateData.checkpoints = admin.firestore.FieldValue.arrayUnion(checkpoint);
        } else if (bossHpPercent !== undefined && bossHpPercent !== null) {
          // Save checkpoint at 75%, 50%, 25% HP
          const thresholds = [75, 50, 25];
          const lastHpPercent = instance.lastCheckpoint?.bossHpPercent;
          
          if (lastHpPercent !== undefined) {
            for (const threshold of thresholds) {
              if ((lastHpPercent > threshold && bossHpPercent <= threshold) ||
                  (lastHpPercent < threshold && bossHpPercent >= threshold)) {
                updateData.lastCheckpoint = checkpoint;
                updateData.checkpoints = admin.firestore.FieldValue.arrayUnion(checkpoint);
                break;
              }
            }
          }
        }
      } catch (checkpointError) {
        console.error('Error creating checkpoint (non-fatal):', checkpointError);
        // Continue without checkpoint if it fails
      }
    }
    
    console.log('[Raid Progress] Updating instance:', {
      instanceId,
      currentWave: updateData.currentWave,
      participantsCount: updateData.participants?.length,
      participantIdsCount: updateData.participantIds?.length,
      bossHp: updateData.bossHp,
      status: updateData.status,
      hasCheckpoint: !!updateData.lastCheckpoint
    });
    
    await instanceRef.update(updateData);
    
    res.json({
      success: true,
      message: `Wave ${wave} completed`,
      isBossFight: wave >= instance.maxWaves,
      checkpointSaved: updateData.lastCheckpoint !== undefined
    });
  } catch (error) {
    console.error('Error updating raid progress:', error);
    console.error('Error stack:', error.stack);
    console.error('Request body:', req.body);
    res.status(500).json({ 
      error: 'Failed to update raid progress',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Resume raid from checkpoint
router.post('/instance/:instanceId/resume', async (req, res) => {
  try {
    const { instanceId } = req.params;
    
    const instanceRef = db.collection('raidInstances').doc(instanceId);
    const doc = await instanceRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    const instance = doc.data();
    
    if (!instance.lastCheckpoint) {
      return res.status(400).json({ error: 'No checkpoint found to resume from' });
    }
    
    if (instance.status === 'completed' || instance.status === 'failed') {
      return res.status(400).json({ error: 'Cannot resume a completed or failed raid' });
    }
    
    // Return checkpoint data for frontend to restore state
    res.json({
      success: true,
      checkpoint: instance.lastCheckpoint,
      instance: {
        id: doc.id,
        ...instance
      }
    });
  } catch (error) {
    console.error('Error resuming raid from checkpoint:', error);
    res.status(500).json({ error: 'Failed to resume raid' });
  }
});

// Get raid instance status
// Get raid instance (with access check)
router.get('/instance/:instanceId', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { userId } = req.query; // Optional: for access check
    
    const instanceDoc = await db.collection('raidInstances').doc(instanceId).get();
    
    if (!instanceDoc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    const instance = { id: instanceDoc.id, ...instanceDoc.data() };
    
    // Skip authorization check - if someone has the instance ID (e.g., from browser source URL),
    // they're already part of the raid and should have access
    // This allows browser source mode to work without requiring authentication
    
    res.json(instance);
  } catch (error) {
    console.error('Error fetching raid instance:', error);
    res.status(500).json({ error: 'Failed to fetch raid instance' });
  }
});

router.get('/instance/:instanceId/status', async (req, res) => {
  try {
    const { instanceId } = req.params;
    
    const doc = await db.collection('raidInstances').doc(instanceId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching raid instance:', error);
    res.status(500).json({ error: 'Failed to fetch raid instance' });
  }
});

// Complete raid and distribute loot
router.post('/instance/:instanceId/complete', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { success, finalParticipants, finalCombatLog } = req.body;
    
    const instanceRef = db.collection('raidInstances').doc(instanceId);
    const doc = await instanceRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    const instance = doc.data();
    
    if (instance.status === 'completed' || instance.status === 'failed') {
      return res.status(400).json({ error: 'Raid instance is already finished' });
    }
    
    // Import raid and loot data
    const { getRaidById } = await import('../data/raids.js');
    const { generateRaidLoot } = await import('../data/raidLoot.js');
    const raidData = getRaidById(instance.raidId);
    
    if (!success) {
      // Raid failed
      // Use twitchUserId for participantIds (for querying), fallback to userId
      const failedParticipantIds = (finalParticipants || instance.participants || []).map(p => p.twitchUserId || p.userId).filter(Boolean);
      
      await instanceRef.update({
        status: 'failed',
        participants: finalParticipants || instance.participants,
        participantIds: failedParticipantIds.length > 0 ? failedParticipantIds : instance.participantIds,
        combatLog: finalCombatLog || instance.combatLog || [],
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      return res.json({
        success: false,
        message: 'Raid failed',
        rewards: null
      });
    }
    
    // Raid succeeded - generate loot
    const lootDrops = [];
    // Use server-side ROLE_CONFIG instead of client-side game.js
    const { ROLE_CONFIG } = await import('../data/roleConfig.js');
    
    // Generate loot for guaranteed slots
    for (const slot of raidData.rewards.guaranteedLoot) {
      // Randomly assign to a participant
      const randomParticipant = finalParticipants[Math.floor(Math.random() * finalParticipants.length)];
      
      // Determine category from role
      let category = 'dps';
      if (randomParticipant.heroRole) {
        const roleConfig = ROLE_CONFIG[randomParticipant.heroRole.toLowerCase()];
        if (roleConfig) {
          category = roleConfig.category;
        }
      }
      
      const item = generateRaidLoot(
        instance.raidId,
        instance.difficulty,
        category,
        slot,
        raidData.boss.level
      );
      
      if (item) {
        lootDrops.push({
          item: item,
          assignedTo: randomParticipant.userId
        });
      }
    }
    
    // Update instance as completed
    // Use twitchUserId for participantIds (for querying), fallback to userId
    const completedParticipantIds = (finalParticipants || instance.participants || []).map(p => p.twitchUserId || p.userId).filter(Boolean);
    
    await instanceRef.update({
      status: 'completed',
      participants: finalParticipants || instance.participants,
      participantIds: completedParticipantIds.length > 0 ? completedParticipantIds : instance.participantIds,
      combatLog: finalCombatLog || instance.combatLog || [],
      lootDrops: lootDrops,
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Distribute rewards to participants
    const rewardPromises = finalParticipants.map(async (participant) => {
      if (!participant.isAlive && participant.deaths > 2) {
        return; // Dead players get no rewards
      }
      
      const heroDoc = await db.collection('heroes').doc(participant.userId).get();
      
      if (heroDoc.exists) {
        const heroRef = heroDoc.ref;
        const hero = heroDoc.data();
        
        // Add gold and tokens
        await heroRef.update({
          gold: (hero.gold || 0) + raidData.rewards.gold,
          tokens: (hero.tokens || 0) + raidData.rewards.tokens,
          xp: (hero.xp || 0) + raidData.rewards.experience,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Add loot to inventory
        const participantLoot = lootDrops.filter(drop => drop.assignedTo === participant.userId);
        if (participantLoot.length > 0) {
          const inventory = hero.inventory || [];
          participantLoot.forEach(drop => inventory.push(drop.item));
          
          await heroRef.update({
            inventory: inventory,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    });
    
    await Promise.all(rewardPromises);
    
    res.json({
      success: true,
      message: 'Raid completed successfully!',
      rewards: {
        gold: raidData.rewards.gold,
        tokens: raidData.rewards.tokens,
        experience: raidData.rewards.experience,
        loot: lootDrops
      }
    });
  } catch (error) {
    console.error('Error completing raid:', error);
    res.status(500).json({ error: 'Failed to complete raid' });
  }
});

// ==================== RAID SCHEDULING & PUG QUEUES ====================

// Schedule a raid (guild feature)
router.post('/schedule', async (req, res) => {
  try {
    const { raidId, guildId, scheduledTime, participants, organizerId } = req.body;
    
    if (!raidId || !scheduledTime || !participants || participants.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!organizerId) {
      return res.status(400).json({ error: 'Organizer ID is required' });
    }
    
    // Import raid data
    const { getRaidById } = await import('../data/raids.js');
    const raidData = getRaidById(raidId);
    
    if (!raidData) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    // Create scheduled raid instance
    const scheduledRaid = {
      raidId: raidData.id,
      difficulty: raidData.difficulty,
      status: 'scheduled',
      organizerId: organizerId, // Instance owner/organizer
      guildId: guildId || null,
      scheduledTime: admin.firestore.Timestamp.fromDate(new Date(scheduledTime)),
      participants: participants,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const instanceRef = await db.collection('raidInstances').add(scheduledRaid);
    
    res.json({
      success: true,
      instanceId: instanceRef.id,
      message: 'Raid scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling raid:', error);
    res.status(500).json({ error: 'Failed to schedule raid' });
  }
});

// Join PUG queue for a raid (class-based signup like dungeons)
router.post('/queue/:raidId/join', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { userId, heroId, role, itemScore } = req.body;
    
    if (!userId || !heroId || !role) {
      return res.status(400).json({ error: 'Missing required fields: userId, heroId, role' });
    }
    
    const validRoles = ['tank', 'healer', 'dps'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be tank, healer, or dps' });
    }
    
    // Import raid data
    const { getRaidById } = await import('../data/raids.js');
    const raidData = getRaidById(raidId);
    
    if (!raidData) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    // Get hero data to check requirements
    const heroDoc = await db.collection('heroes').doc(heroId).get();
    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = heroDoc.data();
    const heroLevel = hero.level || 1;
    const heroItemScore = itemScore || 0;
    
    // Check if user meets requirements
    if (heroLevel < raidData.minLevel || heroItemScore < raidData.minItemScore) {
      return res.status(400).json({ 
        error: `Requirements not met. Need Level ${raidData.minLevel} and ${raidData.minItemScore} item score` 
      });
    }
    
    // Get or create queue for this raid
    const queueRef = db.collection('raidQueues').doc(raidId);
    const queueDoc = await queueRef.get();
    
    let queue = queueDoc.exists ? queueDoc.data() : {
      raidId,
      participants: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Check if user already in queue
    if (queue.participants.some(p => p.userId === userId)) {
      return res.status(400).json({ error: 'Already in queue' });
    }
    
    // Add to queue with role
    const participant = {
      userId,
      heroId,
      heroName: hero.name || 'Unknown',
      heroLevel,
      heroRole: role,
      itemScore: heroItemScore,
      role, // Store role for matchmaking
      joinedAt: Date.now()
    };
    
    queue.participants.push(participant);
    
    await queueRef.set({
      ...queue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Try to matchmake based on class requirements
    await tryRaidMatchmaking(raidId, raidData);
    
    // Get updated queue status
    const updatedQueue = await queueRef.get();
    const currentQueue = updatedQueue.data();
    
    // Calculate role counts
    const roleCounts = {
      tank: currentQueue.participants.filter((p) => p.role === 'tank').length,
      healer: currentQueue.participants.filter((p) => p.role === 'healer').length,
      dps: currentQueue.participants.filter((p) => p.role === 'dps').length
    };
    
    res.json({
      success: true,
      message: 'Added to queue',
      position: currentQueue.participants.length,
      queueSize: currentQueue.participants.length,
      roleCounts,
      estimatedWait: estimateRaidWaitTime(roleCounts, role, raidData)
    });
  } catch (error) {
    console.error('Error joining raid queue:', error);
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

// Get queue status for a raid
router.get('/queue/:raidId', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { userId } = req.query;
    
    const queueDoc = await db.collection('raidQueues').doc(raidId).get();
    
    if (!queueDoc.exists) {
      return res.json({ 
        inQueue: false,
        queueSize: 0, 
        participants: [],
        roleCounts: { tank: 0, healer: 0, dps: 0 },
        message: 'No one in queue yet'
      });
    }
    
    const queue = queueDoc.data();
    
    // Calculate role counts
    const roleCounts = {
      tank: queue.participants.filter((p) => p.role === 'tank').length,
      healer: queue.participants.filter((p) => p.role === 'healer').length,
      dps: queue.participants.filter((p) => p.role === 'dps').length
    };
    
    // Check if user is in queue
    const userInQueue = userId ? queue.participants.some((p) => p.userId === userId) : false;
    const userEntry = userId ? queue.participants.find((p) => p.userId === userId) : null;
    
    res.json({
      inQueue: userInQueue,
      queueSize: queue.participants.length,
      participants: queue.participants,
      roleCounts,
      userRole: userEntry?.role,
      lastUpdated: queue.updatedAt
    });
  } catch (error) {
    console.error('Error fetching raid queue:', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

// Leave PUG queue
router.post('/queue/:raidId/leave', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const queueRef = db.collection('raidQueues').doc(raidId);
    const queueDoc = await queueRef.get();
    
    if (!queueDoc.exists) {
      return res.status(404).json({ error: 'Queue not found' });
    }
    
    const queue = queueDoc.data();
    queue.participants = queue.participants.filter((p) => p.userId !== userId);
    
    if (queue.participants.length === 0) {
      // Delete empty queue
      await queueRef.delete();
    } else {
      await queueRef.update({
        participants: queue.participants,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    res.json({ success: true, message: 'Left queue' });
  } catch (error) {
    console.error('Error leaving raid queue:', error);
    res.status(500).json({ error: 'Failed to leave queue' });
  }
});

// Raid matchmaking function (similar to dungeon matchmaking)
async function tryRaidMatchmaking(raidId, raidData) {
  try {
    const queueRef = db.collection('raidQueues').doc(raidId);
    const queueDoc = await queueRef.get();
    
    if (!queueDoc.exists) return;
    
    const queue = queueDoc.data();
    const participants = queue.participants || [];
    
    // Group by role
    const tanks = participants.filter((p) => p.role === 'tank');
    const healers = participants.filter((p) => p.role === 'healer');
    const dps = participants.filter((p) => p.role === 'dps');
    
    // Raid composition: 2 tanks, 2-3 healers, rest DPS
    const requiredTanks = 2;
    const requiredHealers = Math.min(3, Math.ceil(raidData.minPlayers * 0.2)); // 20% healers, max 3
    const requiredDps = raidData.minPlayers - requiredTanks - requiredHealers;
    
    // Check if we have enough of each role
    if (tanks.length >= requiredTanks && 
        healers.length >= requiredHealers && 
        dps.length >= requiredDps) {
      
      // Form group
      const group = {
        tanks: tanks.slice(0, requiredTanks),
        healers: healers.slice(0, requiredHealers),
        dps: dps.slice(0, requiredDps)
      };
      
      const allGroupMembers = [...group.tanks, ...group.healers, ...group.dps];
      const participantIds = allGroupMembers.map((p) => p.userId);
      
      // Remove from queue
      const remainingParticipants = participants.filter((p) => 
        !participantIds.includes(p.userId)
      );
      
      if (remainingParticipants.length === 0) {
        await queueRef.delete();
      } else {
        await queueRef.update({
          participants: remainingParticipants,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Start raid instance
      try {
        const startResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/raids/${raidId}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participants: participantIds })
        });
        
        if (startResponse.ok) {
          console.log(`✅ Raid group formed for ${raidId}: ${requiredTanks} tanks, ${requiredHealers} healers, ${requiredDps} DPS`);
        }
      } catch (err) {
        console.error('Error starting raid from matchmaking:', err);
      }
    }
  } catch (error) {
    console.error('Error in raid matchmaking:', error);
  }
}

// Estimate wait time for raid queue
function estimateRaidWaitTime(roleCounts, userRole, raidData) {
  const requiredTanks = 2;
  const requiredHealers = Math.min(3, Math.ceil(raidData.minPlayers * 0.2));
  const requiredDps = raidData.minPlayers - requiredTanks - requiredHealers;
  
  if (userRole === 'tank') {
    const needed = requiredTanks - roleCounts.tank;
    return needed <= 0 ? 0 : needed * 30; // 30 seconds per missing tank
  }
  
  if (userRole === 'healer') {
    const needed = requiredHealers - roleCounts.healer;
    if (needed <= 0) return 0;
    const hasTanks = roleCounts.tank >= requiredTanks;
    return hasTanks ? needed * 45 : needed * 90; // Faster if tanks available
  }
  
  if (userRole === 'dps') {
    const needed = requiredDps - roleCounts.dps;
    if (needed <= 0) return 120; // Too many DPS
    const hasTanks = roleCounts.tank >= requiredTanks;
    const hasHealers = roleCounts.healer >= requiredHealers;
    if (hasTanks && hasHealers) return needed * 30;
    if (hasTanks || hasHealers) return needed * 60;
    return needed * 120;
  }
  
  return 60;
}

// ==================== GUILD RAID SIGNUP ====================

// Get guild raid signup status
router.get('/:raidId/guild-signup/:guildId', async (req, res) => {
  try {
    const { raidId, guildId } = req.params;
    
    const signupDoc = await db.collection('guildRaidSignups')
      .where('raidId', '==', raidId)
      .where('guildId', '==', guildId)
      .limit(1)
      .get();
    
    if (signupDoc.empty) {
      return res.json({ 
        signedUp: false,
        signup: null
      });
    }
    
    const signup = signupDoc.docs[0].data();
    res.json({
      signedUp: true,
      signup: {
        id: signupDoc.docs[0].id,
        ...signup
      }
    });
  } catch (error) {
    console.error('Error fetching guild raid signup:', error);
    res.status(500).json({ error: 'Failed to fetch guild raid signup' });
  }
});

// Guild signup for raid
router.post('/:raidId/guild-signup', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { guildId, assignedPlayers } = req.body;
    
    if (!guildId || !assignedPlayers || !Array.isArray(assignedPlayers)) {
      return res.status(400).json({ error: 'guildId and assignedPlayers array are required' });
    }
    
    // Import raid data
    const { getRaidById } = await import('../data/raids.js');
    const raidData = getRaidById(raidId);
    
    if (!raidData) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    // Validate assigned players count
    const minRequired = Math.ceil(raidData.minPlayers / 2);
    if (assignedPlayers.length < minRequired) {
      return res.status(400).json({ 
        error: `Need at least ${minRequired} players (half of ${raidData.minPlayers} minimum)` 
      });
    }
    
    if (assignedPlayers.length > raidData.maxPlayers) {
      return res.status(400).json({ 
        error: `Cannot assign more than ${raidData.maxPlayers} players` 
      });
    }
    
    // Validate each assigned player meets requirements
    for (const player of assignedPlayers) {
      if (player.heroLevel < raidData.minLevel) {
        return res.status(400).json({ 
          error: `${player.heroName || 'Player'} does not meet level requirement (Level ${raidData.minLevel} required)` 
        });
      }
      
      if (player.itemScore < raidData.minItemScore) {
        return res.status(400).json({ 
          error: `${player.heroName || 'Player'} does not meet item score requirement (${raidData.minItemScore} required)` 
        });
      }
    }
    
    // Check if guild exists
    const guildDoc = await db.collection('guilds').doc(guildId).get();
    if (!guildDoc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    // Check if signup already exists
    const existingSignup = await db.collection('guildRaidSignups')
      .where('raidId', '==', raidId)
      .where('guildId', '==', guildId)
      .limit(1)
      .get();
    
    const signupData = {
      raidId,
      guildId,
      assignedPlayers,
      status: 'pending',
      signedUpAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (!existingSignup.empty) {
      // Update existing signup
      const signupRef = existingSignup.docs[0].ref;
      await signupRef.update(signupData);
      
      res.json({
        success: true,
        signupId: signupRef.id,
        message: 'Guild raid signup updated successfully'
      });
    } else {
      // Create new signup
      const signupRef = await db.collection('guildRaidSignups').add(signupData);
      
      res.json({
        success: true,
        signupId: signupRef.id,
        message: 'Guild signed up for raid successfully'
      });
    }
  } catch (error) {
    console.error('Error signing up guild for raid:', error);
    res.status(500).json({ error: 'Failed to sign up guild for raid' });
  }
});

// Update guild raid signup (for adding/removing players)
router.put('/:raidId/guild-signup/:guildId', async (req, res) => {
  try {
    const { raidId, guildId } = req.params;
    const { assignedPlayers } = req.body;
    
    if (!assignedPlayers || !Array.isArray(assignedPlayers)) {
      return res.status(400).json({ error: 'assignedPlayers array is required' });
    }
    
    // Import raid data
    const { getRaidById } = await import('../data/raids.js');
    const raidData = getRaidById(raidId);
    
    if (!raidData) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    // Validate assigned players count
    const minRequired = Math.ceil(raidData.minPlayers / 2);
    if (assignedPlayers.length < minRequired) {
      return res.status(400).json({ 
        error: `Need at least ${minRequired} players (half of ${raidData.minPlayers} minimum)` 
      });
    }
    
    if (assignedPlayers.length > raidData.maxPlayers) {
      return res.status(400).json({ 
        error: `Cannot assign more than ${raidData.maxPlayers} players` 
      });
    }
    
    // Find existing signup
    const existingSignup = await db.collection('guildRaidSignups')
      .where('raidId', '==', raidId)
      .where('guildId', '==', guildId)
      .limit(1)
      .get();
    
    if (existingSignup.empty) {
      return res.status(404).json({ error: 'Guild signup not found' });
    }
    
    // Validate each assigned player meets requirements
    for (const player of assignedPlayers) {
      if (player.heroLevel < raidData.minLevel) {
        return res.status(400).json({ 
          error: `${player.heroName || 'Player'} does not meet level requirement (Level ${raidData.minLevel} required)` 
        });
      }
      
      if (player.itemScore < raidData.minItemScore) {
        return res.status(400).json({ 
          error: `${player.heroName || 'Player'} does not meet item score requirement (${raidData.minItemScore} required)` 
        });
      }
    }
    
    // Update signup
    const signupRef = existingSignup.docs[0].ref;
    await signupRef.update({
      assignedPlayers,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Guild raid signup updated successfully'
    });
  } catch (error) {
    console.error('Error updating guild raid signup:', error);
    res.status(500).json({ error: 'Failed to update guild raid signup' });
  }
});

// Send command to raid instance (for participants to control their hero)
router.post('/instance/:instanceId/command', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { userId, command } = req.body;
    
    if (!userId || !command) {
      return res.status(400).json({ error: 'userId and command are required' });
    }
    
    const instanceDoc = await db.collection('raidInstances').doc(instanceId).get();
    
    if (!instanceDoc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    const instance = instanceDoc.data();
    
    // Check if user is a participant
    const participant = instance.participants?.find((p) => p.userId === userId);
    if (!participant) {
      return res.status(403).json({ error: 'You are not a participant in this instance' });
    }
    
    // Check if instance is active
    if (instance.status !== 'active' && instance.status !== 'starting') {
      return res.status(400).json({ error: 'Instance is not active' });
    }
    
    // Add command to combat log
    const combatLogEntry = {
      timestamp: Date.now(),
      message: `${participant.heroName || participant.username || 'Player'} used command: ${command}`,
      type: 'command',
      userId: userId,
      username: participant.heroName || participant.username || 'Player',
      command: command
    };
    
    await instanceDoc.ref.update({
      combatLog: admin.firestore.FieldValue.arrayUnion(combatLogEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Command received',
      command: command
    });
  } catch (error) {
    console.error('Error processing command:', error);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// Send chat message to raid instance
router.post('/instance/:instanceId/chat', async (req, res) => {
  try {
    const { instanceId } = req.params;
    const { userId, message } = req.body;
    
    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required' });
    }
    
    const instanceDoc = await db.collection('raidInstances').doc(instanceId).get();
    
    if (!instanceDoc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    const instance = instanceDoc.data();
    
    // Check if user is a participant
    const participant = instance.participants?.find((p) => p.userId === userId);
    if (!participant) {
      return res.status(403).json({ error: 'You are not a participant in this instance' });
    }
    
    // Add chat message to combat log
    const chatEntry = {
      timestamp: Date.now(),
      message: message,
      type: 'chat',
      userId: userId,
      username: participant.heroName || participant.username || 'Player'
    };
    
    await instanceDoc.ref.update({
      combatLog: admin.firestore.FieldValue.arrayUnion(chatEntry),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Chat message sent'
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Failed to send chat message' });
  }
});

// ==================== RAID SIMULATION ====================

// Simulate a raid (instant, reduced rewards)
router.post('/:raidId/simulate', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { participants } = req.body; // Array of hero IDs
    
    console.log(`[Simulate] Simulating raid ${raidId}`);
    console.log(`[Simulate] Received participants:`, participants);
    console.log(`[Simulate] Participants type:`, typeof participants);
    console.log(`[Simulate] Is array:`, Array.isArray(participants));
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'No participants provided' });
    }
    
    // Get raid data
    const raidDoc = await db.collection('raids').doc(raidId).get();
    if (!raidDoc.exists) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    const raid = raidDoc.data();
    
    // Fetch hero data
    const heroes = [];
    for (const heroId of participants) {
      console.log(`[Simulate] Fetching hero: ${heroId}`);
      const heroDoc = await db.collection('heroes').doc(heroId).get();
      if (heroDoc.exists) {
        const heroData = heroDoc.data();
        // Store document ID separately to avoid confusion with hero.id field
        heroes.push({ 
          docId: heroDoc.id,  // Firestore document ID (for updates)
          ...heroData         // Hero data (includes internal id field)
        });
        console.log(`[Simulate] ✅ Found hero: ${heroData.name} (Lv${heroData.level}) - DocID: ${heroDoc.id}`);
      } else {
        console.log(`[Simulate] ❌ Hero not found: ${heroId}`);
      }
    }
    
    console.log(`[Simulate] Total heroes found: ${heroes.length}`);
    
    if (heroes.length === 0) {
      return res.status(400).json({ error: 'No valid heroes found', providedIds: participants });
    }
    
    // Calculate average stats
    const avgLevel = heroes.reduce((sum, h) => sum + (h.level || 1), 0) / heroes.length;
    const avgItemScore = heroes.reduce((sum, h) => {
      let score = 0;
      if (h.equipment) {
        Object.values(h.equipment).forEach(item => {
          if (item) {
            score += (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
          }
        });
      }
      return sum + score;
    }, 0) / heroes.length;
    
    // Calculate success chance
    const raidScore = (raid.minLevel || 1) + ((raid.minItemScore || 0) / 10);
    const heroScore = avgLevel + (avgItemScore / 100);
    const successChance = Math.min(0.95, Math.max(0.1, heroScore / raidScore));
    
    console.log(`[Simulate] Hero score: ${heroScore.toFixed(1)}, Raid score: ${raidScore.toFixed(1)}, Success: ${(successChance * 100).toFixed(1)}%`);
    
    // Roll for success
    const succeeded = Math.random() < successChance;
    
    // Calculate rewards (70% for simulation)
    const baseXP = (raid.rewards?.experience || 1000) * (succeeded ? 0.7 : 0.2);
    const baseGold = (raid.rewards?.gold || 100) * (succeeded ? 0.7 : 0.2);
    const xpPerHero = Math.floor(baseXP / heroes.length);
    const goldPerHero = Math.floor(baseGold / heroes.length);
    
    // Apply rewards to heroes
    const batch = db.batch();
    const rewardedHeroes = [];
    
    for (const hero of heroes) {
      const heroRef = db.collection('heroes').doc(hero.docId); // Use Firestore document ID!
      
      batch.update(heroRef, {
        xp: admin.firestore.FieldValue.increment(xpPerHero),
        gold: admin.firestore.FieldValue.increment(goldPerHero),
        'stats.raidSimulations': admin.firestore.FieldValue.increment(1),
        'stats.raidSimulationWins': admin.firestore.FieldValue.increment(succeeded ? 1 : 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      rewardedHeroes.push({
        name: hero.name,
        xp: xpPerHero,
        gold: goldPerHero
      });
    }
    
    await batch.commit();
    
    console.log(`[Simulate] ${succeeded ? '✅ SUCCESS' : '❌ FAILURE'} - Distributed rewards to ${heroes.length} heroes`);
    
    res.json({
      success: true,
      outcome: succeeded ? 'success' : 'failure',
      successChance: Math.floor(successChance * 100),
      rewards: {
        xpPerHero,
        goldPerHero,
        rewardedHeroes
      },
      message: succeeded 
        ? `Success! Each hero received ${xpPerHero} XP and ${goldPerHero}g (70% simulation penalty)`
        : `Raid failed! Each hero received ${xpPerHero} XP and ${goldPerHero}g (consolation rewards)`
    });
  } catch (error) {
    console.error('Error simulating raid:', error);
    res.status(500).json({ error: 'Failed to simulate raid' });
  }
});

// ==================== SCHEDULED GUILD RAIDS ====================

// Create a scheduled guild raid (guild leader schedules raid for later)
router.post('/:raidId/schedule', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { guildId, scheduledTime, organizer, organizerName, initialAssignments, status } = req.body;
    
    console.log(`[Scheduled Raid] Creating scheduled raid for guild ${guildId}, raid ${raidId}`);
    
    // Get the raid data to include name and details
    const raidDoc = await db.collection('raids').doc(raidId).get();
    const raidData = raidDoc.exists ? raidDoc.data() : null;
    
    // Create scheduled raid signup
    const scheduledRaid = {
      raidId,
      raidName: raidData?.name || raidId,
      raidDifficulty: raidData?.difficulty || 'normal',
      minPlayers: raidData?.minPlayers || 5,
      maxPlayers: raidData?.maxPlayers || 10,
      minLevel: raidData?.minLevel || 1,
      minItemScore: raidData?.minItemScore || 0,
      guildId,
      scheduledTime: scheduledTime ? admin.firestore.Timestamp.fromDate(new Date(scheduledTime)) : null,
      organizer,
      organizerName,
      status: status || 'recruiting',
      participants: initialAssignments || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('scheduledGuildRaids').add(scheduledRaid);
    
    console.log(`[Scheduled Raid] Created signup ${docRef.id} for ${raidData?.name || raidId}`);
    
    res.json({
      success: true,
      signupId: docRef.id
    });
  } catch (error) {
    console.error('Error creating scheduled raid:', error);
    res.status(500).json({ error: 'Failed to create scheduled raid' });
  }
});

// Get scheduled raids for a battlefield (for browser source auto-start)
router.get('/scheduled/battlefield/:battlefieldId', async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    
    // Find all scheduled raids where participants have heroes on this battlefield
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    const heroIds = heroesSnapshot.docs.map(doc => doc.id);
    
    if (heroIds.length === 0) {
      return res.json([]);
    }
    
    // Find scheduled raids with these heroes
    const scheduledSnapshot = await db.collection('scheduledGuildRaids')
      .where('status', 'in', ['recruiting', 'ready', 'pending'])
      .get();
    
    const relevantRaids = scheduledSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(raid => {
        // Check if any participants are from this battlefield
        return raid.participants?.some(p => heroIds.includes(p.heroId));
      });
    
    console.log(`[Scheduled Raids] Found ${relevantRaids.length} for battlefield ${battlefieldId}`);
    
    res.json(relevantRaids);
  } catch (error) {
    console.error('Error fetching battlefield scheduled raids:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled raids' });
  }
});

// Get scheduled raids for a guild
router.get('/scheduled/guild/:guildId', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    // Simplified query (no composite index needed)
    const snapshot = await db.collection('scheduledGuildRaids')
      .where('guildId', '==', guildId)
      .get();
    
    // Filter and sort in memory
    const scheduledRaids = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(raid => ['recruiting', 'ready', 'pending'].includes(raid.status))
      .sort((a, b) => {
        const timeA = a.scheduledTime?.seconds || 0;
        const timeB = b.scheduledTime?.seconds || 0;
        return timeA - timeB;
      });
    
    console.log(`[Scheduled Raids] Found ${scheduledRaids.length} for guild ${guildId}`);
    
    res.json(scheduledRaids);
  } catch (error) {
    console.error('Error fetching scheduled raids:', error);
    res.status(500).json({ error: 'Failed to fetch scheduled raids' });
  }
});

// Sign up for a scheduled raid (member self-signup)
router.post('/scheduled/:signupId/signup', async (req, res) => {
  try {
    const { signupId } = req.params;
    const { heroId, heroName, heroLevel, heroRole, itemScore } = req.body;
    
    const signupRef = db.collection('scheduledGuildRaids').doc(signupId);
    const signupDoc = await signupRef.get();
    
    if (!signupDoc.exists) {
      return res.status(404).json({ error: 'Scheduled raid not found' });
    }
    
    const signup = signupDoc.data();
    
    // Check if already signed up
    if (signup.participants.some((p) => p.heroId === heroId)) {
      return res.status(400).json({ error: 'Already signed up for this raid' });
    }
    
    // Add participant
    const newParticipant = {
      userId: heroId, // For compatibility
      heroId,
      heroName,
      heroLevel,
      heroRole,
      itemScore,
      signedUpAt: admin.firestore.Timestamp.now()
    };
    
    await signupRef.update({
      participants: admin.firestore.FieldValue.arrayUnion(newParticipant),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Scheduled Raid] ${heroName} signed up for ${signupId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error signing up for scheduled raid:', error);
    res.status(500).json({ error: 'Failed to sign up' });
  }
});

// Leave a scheduled raid
router.post('/scheduled/:signupId/leave', async (req, res) => {
  try {
    const { signupId } = req.params;
    const { heroId } = req.body;
    
    const signupRef = db.collection('scheduledGuildRaids').doc(signupId);
    const signupDoc = await signupRef.get();
    
    if (!signupDoc.exists) {
      return res.status(404).json({ error: 'Scheduled raid not found' });
    }
    
    const signup = signupDoc.data();
    const updatedParticipants = signup.participants.filter((p) => p.heroId !== heroId);
    
    await signupRef.update({
      participants: updatedParticipants,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Scheduled Raid] Hero ${heroId} left ${signupId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error leaving scheduled raid:', error);
    res.status(500).json({ error: 'Failed to leave raid' });
  }
});

// Delete/cancel a scheduled raid
router.delete('/scheduled/:signupId', async (req, res) => {
  try {
    const { signupId } = req.params;
    const { organizerId } = req.body;
    
    const signupRef = db.collection('scheduledGuildRaids').doc(signupId);
    const signupDoc = await signupRef.get();
    
    if (!signupDoc.exists) {
      return res.status(404).json({ error: 'Scheduled raid not found' });
    }
    
    const signup = signupDoc.data();
    
    // Only organizer can delete
    if (signup.organizer !== organizerId) {
      return res.status(403).json({ error: 'Only the organizer can cancel this raid' });
    }
    
    // Delete the scheduled raid
    await signupRef.delete();
    
    console.log(`[Scheduled Raid] Deleted ${signupId} by ${organizerId}`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting scheduled raid:', error);
    res.status(500).json({ error: 'Failed to delete raid' });
  }
});

// Start a scheduled raid manually (before scheduled time)
router.post('/scheduled/:signupId/start', async (req, res) => {
  try {
    const { signupId } = req.params;
    
    const signupRef = db.collection('scheduledGuildRaids').doc(signupId);
    const signupDoc = await signupRef.get();
    
    if (!signupDoc.exists) {
      return res.status(404).json({ error: 'Scheduled raid not found' });
    }
    
    const signup = signupDoc.data();
    
    // Start the raid
    const heroIds = signup.participants.map((p) => p.heroId);
    
    // Use the existing startRaid logic
    const startResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/raids/${signup.raidId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: heroIds })
    });
    
    const startData = await startResponse.json();
    
    if (!startData.success) {
      return res.status(400).json({ error: startData.message || 'Failed to start raid' });
    }
    
    // Mark scheduled raid as started
    await signupRef.update({
      status: 'started',
      instanceId: startData.instanceId,
      startedAt: admin.firestore.Timestamp.now()
    });
    
    console.log(`[Scheduled Raid] Started ${signupId} → instance ${startData.instanceId}`);
    
    res.json({
      success: true,
      instanceId: startData.instanceId
    });
  } catch (error) {
    console.error('Error starting scheduled raid:', error);
    res.status(500).json({ error: 'Failed to start raid' });
  }
});

export default router;
