import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Get all raids
router.get('/', async (req, res) => {
  try {
    const { type, status } = req.query;
    
    // Get raids from data file (not Firestore - raids are static data)
    // NOTE: Raids are defined in ../data/raids.js, NOT in Firestore
    const { RAIDS } = await import('../data/raids.js');
    
    console.log('[GET /api/raids] Loaded raids from data file:', Object.keys(RAIDS).length, 'raids');
    
    // LAUNCH: Only Corrupted Temple is available for launch
    const launchRaidId = 'corrupted_temple';
    
    let raids = Object.values(RAIDS).map(raid => ({
      id: raid.id,
      name: raid.name,
      difficulty: raid.difficulty,
      type: raid.type || (raid.difficulty === 'normal' ? 'daily' : raid.difficulty === 'heroic' ? 'weekly' : 'monthly'), // Map difficulty to type
      minLevel: raid.minLevel,
      minItemScore: raid.minItemScore,
      minPlayers: raid.minPlayers,
      maxPlayers: raid.maxPlayers,
      waves: raid.waves,
      description: raid.description,
      estimatedDuration: raid.estimatedDuration,
      rewards: raid.rewards,
      available: raid.id === launchRaidId, // Only Corrupted Temple is available
      // Include boss info but not all mechanics
      boss: {
        name: raid.boss.name,
        hp: raid.boss.hp,
        attack: raid.boss.attack,
        defense: raid.boss.defense,
        level: raid.boss.level
      }
    }));
    
    console.log('[GET /api/raids] Mapped raids:', raids.map(r => r.id).join(', '));
    
    // Filter by type if provided
    if (type) {
      raids = raids.filter(raid => raid.type === type);
      console.log('[GET /api/raids] Filtered by type:', type, '->', raids.length, 'raids');
    }
    
    // Filter by status if provided (though status doesn't really apply to static raids)
    // This is mainly for future scheduled raids if needed
    if (status) {
      // For now, all static raids are 'available'
      raids = raids.filter(raid => !status || status === 'available');
    }
    
    console.log('[GET /api/raids] Returning', raids.length, 'raids');
    res.json(raids);
  } catch (error) {
    console.error('[GET /api/raids] Error fetching raids:', error);
    res.status(500).json({ error: 'Failed to fetch raids', details: error.message });
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
    
    // Import raid data
    const { RAIDS, getRaidById } = await import('../data/raids.js');
    const allRaids = Object.values(RAIDS);
    
    // LAUNCH: Only return Corrupted Temple for now (we'll add more after launch)
    const launchRaidId = 'corrupted_temple';
    const launchRaid = getRaidById(launchRaidId);
    
    // Filter by level and item score requirements
    let availableRaids = [];
    if (launchRaid) {
      const meetsLevel = !launchRaid.minLevel || heroLevel >= launchRaid.minLevel;
      const meetsItemScore = !launchRaid.minItemScore || itemScore >= launchRaid.minItemScore;
      
      if (meetsLevel && meetsItemScore) {
        availableRaids = [launchRaid];
      }
    }
    
    // TODO: After launch, uncomment this to show all available raids:
    // const availableRaids = allRaids.filter(raid => {
    //   if (raid.minLevel && heroLevel < raid.minLevel) return false;
    //   if (raid.minItemScore && itemScore < raid.minItemScore) return false;
    //   return true;
    // });
    
    res.json({
      heroLevel,
      itemScore,
      availableRaids
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
export async function tryRaidMatchmaking(raidId, raidData) {
  try {
    const queueRef = db.collection('raidQueues').doc(raidId);
    const queueDoc = await queueRef.get();
    
    if (!queueDoc.exists) return;
    
    const queue = queueDoc.data();
    const participants = queue.participants || [];
    
    // PRIORITY 1: Check for complete parties first
    const partyGroups = new Map(); // partyId -> array of participants
    participants.forEach(p => {
      if (p.partyId) {
        if (!partyGroups.has(p.partyId)) {
          partyGroups.set(p.partyId, []);
        }
        partyGroups.get(p.partyId).push(p);
      }
    });
    
    // Try to match complete parties (all members together)
    for (const [partyId, partyMembers] of partyGroups.entries()) {
      const firstMember = partyMembers[0];
      const fillParty = firstMember?.fillParty !== false; // Default to true
      
      if (partyMembers.length >= raidData.minPlayers && partyMembers.length <= raidData.maxPlayers) {
        // Check if party has sufficient composition
        const partyTanks = partyMembers.filter(p => p.role === 'tank');
        const partyHealers = partyMembers.filter(p => p.role === 'healer');
        const partyDps = partyMembers.filter(p => p.role === 'dps');
        
        const requiredTanks = 2;
        const requiredHealers = Math.min(3, Math.ceil(raidData.minPlayers * 0.2));
        const requiredDps = raidData.minPlayers - requiredTanks - requiredHealers;
        
        // Check if party meets minimum requirements
        // If fillParty is false, start immediately if party meets min requirements
        // If fillParty is true, only start if party is full or meets requirements
        if (partyTanks.length >= requiredTanks && 
            partyHealers.length >= requiredHealers && 
            partyDps.length >= requiredDps) {
          
          // If fillParty is false and party meets min requirements, start immediately
          if (!fillParty || partyMembers.length === raidData.maxPlayers) {
          
          // Match the entire party together
          const participantIds = partyMembers.map(p => p.userId);
          
          // Remove party from queue
          const remainingParticipants = participants.filter(p => 
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
          
          // Update party status
          try {
            const partyRef = db.collection('parties').doc(partyId);
            await partyRef.update({
              status: 'in_instance',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            console.error(`[Raid Matchmaking] Failed to update party ${partyId} status:`, error);
          }
          
          // Create raid instance directly (like dungeon matchmaking)
          try {
            // Load participant hero data
            const participantData = [];
            for (const member of partyMembers) {
              const heroDoc = await db.collection('heroes').doc(member.heroId).get();
              if (!heroDoc.exists) {
                console.warn(`[Raid Matchmaking] Hero not found: ${member.heroId}, skipping...`);
                continue;
              }
              const hero = heroDoc.data();
              const twitchUserId = hero.twitchUserId || member.userId;
              
              // Calculate item score
              let itemScore = 0;
              if (hero.equipment) {
                Object.values(hero.equipment).forEach(item => {
                  if (item) {
                    if (item.itemScore) {
                      itemScore += item.itemScore;
                    } else {
                      const baseScore = (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
                      const rarityBonus = item.rarity === 'legendary' ? 1.5 : 
                                          item.rarity === 'epic' ? 1.3 : 
                                          item.rarity === 'rare' ? 1.1 : 1.0;
                      itemScore += Math.floor(baseScore * rarityBonus);
                    }
                  }
                });
              }
              
              participantData.push({
                userId: member.userId,
                heroId: member.heroId,
                username: member.heroName || hero.name || member.userId,
                heroName: member.heroName || hero.name,
                heroLevel: member.heroLevel || hero.level || 1,
                heroRole: member.role || hero.role,
                itemScore: itemScore,
                isAlive: true,
                damageDealt: 0,
                healingDone: 0,
                damageTaken: 0,
                deaths: 0,
                currentHp: hero.stats?.hp || hero.hp || hero.stats?.maxHp || hero.maxHp || 100,
                maxHp: hero.stats?.maxHp || hero.maxHp || 100
              });
            }
            
            if (participantData.length < raidData.minPlayers) {
              console.warn(`[Raid Matchmaking] Not enough valid heroes: ${participantData.length} < ${raidData.minPlayers}`);
              continue;
            }
            
            // Extract participant IDs for querying
            const participantUserIds = participantData.map(p => p.userId).filter(Boolean);
            
            // Use first member as organizer
            const organizerId = partyMembers[0].userId;
            
            // Generate wave enemies for each wave (except final boss wave)
            const totalWaves = raidData.waves || 3;
            const waveEnemies = [];
            
            for (let wave = 0; wave < totalWaves - 1; wave++) {
              // Generate enemies for this wave - raid-specific pools
              let enemyPool;
              
              // Corrupted Temple: Mimics, Skeleton Mages, Cultists
              if (raidData.id === 'corrupted_temple') {
                enemyPool = [
                  { name: 'Mimic', weight: 3 },
                  { name: 'Skeleton Mage', weight: 3 },
                  { name: 'Cultist', weight: 2 }
                ];
              } else {
                // Default enemy pool for other raids
                enemyPool = [
                  { name: 'Goblin', weight: 3 },
                  { name: 'Orc', weight: 2 },
                  { name: 'Skeleton', weight: 2 },
                  { name: 'Imp', weight: 2 },
                  { name: 'Witch', weight: 1 },
                  { name: 'Skeleton Mage', weight: 1 }
                ];
                
                // Heroic and Mythic add more dangerous enemies
                if (raidData.difficulty === 'heroic' || raidData.difficulty === 'mythic') {
                  enemyPool.push(
                    { name: 'Demon Lord', weight: 1 },
                    { name: 'Adult Dragon', weight: 0.5 }
                  );
                }
              }
              
              // Calculate enemy count (scales with wave)
              const baseCount = 2 + Math.floor(wave / 2);
              const enemyCount = Math.min(baseCount, 5); // Cap at 5 enemies per wave
              
              // Select random enemies based on weights
              const selectedEnemies = [];
              const totalWeight = enemyPool.reduce((sum, e) => sum + e.weight, 0);
              
              for (let i = 0; i < enemyCount; i++) {
                let random = Math.random() * totalWeight;
                for (const enemy of enemyPool) {
                  random -= enemy.weight;
                  if (random <= 0) {
                    selectedEnemies.push(enemy.name);
                    break;
                  }
                }
              }
              
              // Convert to comma-separated string format expected by frontend
              waveEnemies.push(selectedEnemies.join(','));
            }
            
            // Create raid instance
            const raidInstance = {
              raidId: raidData.id,
              difficulty: raidData.difficulty,
              status: 'in_progress',
              organizerId: organizerId,
              participants: participantData,
              participantIds: participantUserIds,
              currentWave: 0,
              waves: totalWaves,
              waveEnemies: waveEnemies, // Generated wave enemies
              boss: {
                name: raidData.boss.name,
                hp: raidData.boss.hp,
                maxHp: raidData.boss.hp,
                attack: raidData.boss.attack,
                defense: raidData.boss.defense || 0,
                level: raidData.boss.level,
                xp: raidData.boss.xp || 1000
              },
              combatLog: [],
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              partyId: partyId
            };
            
            const instanceRef = await db.collection('raidInstances').add(raidInstance);
            
            console.log(`[Raid Matchmaking] 🏰 Created raid instance ${instanceRef.id} for party ${partyId}: ${raidData.name} (${participantData.length} players)`);
            
            // Update all heroes to have activeInstance pointing to this raid
            const participantHeroIds = participantData.map(p => p.heroId);
            const updatePromises = participantHeroIds.map(async (heroId) => {
              try {
                await db.collection('heroes').doc(heroId).update({
                  activeInstance: {
                    type: 'raid',
                    instanceId: instanceRef.id
                  },
                  updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
              } catch (error) {
                console.error(`[Raid Matchmaking] Failed to update hero ${heroId} with active instance:`, error);
              }
            });
            
            await Promise.all(updatePromises);
            console.log(`[Raid Matchmaking] ✅ Updated all ${participantData.length} heroes with active raid instance`);
            
            console.log(`✅ Party ${partyId} matched for raid ${raidId}: ${partyTanks.length} tanks, ${partyHealers.length} healers, ${partyDps.length} DPS`);
            return; // Return after matching a party
          } catch (err) {
            console.error('Error creating raid instance from matchmaking:', err);
          }
          } // End of fillParty check
        }
      }
    }
    
    // PRIORITY 2: Match individual players (existing logic)
    // Remove party members from arrays (they're already processed or incomplete)
    const individualParticipants = participants.filter(p => 
      !p.partyId || !partyGroups.has(p.partyId) || 
      partyGroups.get(p.partyId).length < raidData.minPlayers
    );
    
    // Group by role
    const tanks = individualParticipants.filter((p) => p.role === 'tank');
    const healers = individualParticipants.filter((p) => p.role === 'healer');
    const dps = individualParticipants.filter((p) => p.role === 'dps');
    
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
      
      // Create raid instance directly (like dungeon matchmaking)
      try {
        // Load participant hero data
        const participantData = [];
        for (const member of allGroupMembers) {
          const heroDoc = await db.collection('heroes').doc(member.heroId).get();
          if (!heroDoc.exists) {
            console.warn(`[Raid Matchmaking] Hero not found: ${member.heroId}, skipping...`);
            continue;
          }
          const hero = heroDoc.data();
          
          // Calculate item score
          let itemScore = 0;
          if (hero.equipment) {
            Object.values(hero.equipment).forEach(item => {
              if (item) {
                if (item.itemScore) {
                  itemScore += item.itemScore;
                } else {
                  const baseScore = (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
                  const rarityBonus = item.rarity === 'legendary' ? 1.5 : 
                                      item.rarity === 'epic' ? 1.3 : 
                                      item.rarity === 'rare' ? 1.1 : 1.0;
                  itemScore += Math.floor(baseScore * rarityBonus);
                }
              }
            });
          }
          
          participantData.push({
            userId: member.userId,
            heroId: member.heroId,
            username: member.heroName || hero.name || member.userId,
            heroName: member.heroName || hero.name,
            heroLevel: member.heroLevel || hero.level || 1,
            heroRole: member.role || hero.role,
            itemScore: itemScore,
            isAlive: true,
            damageDealt: 0,
            healingDone: 0,
            damageTaken: 0,
            deaths: 0,
            currentHp: hero.stats?.hp || hero.hp || hero.stats?.maxHp || hero.maxHp || 100,
            maxHp: hero.stats?.maxHp || hero.maxHp || 100
          });
        }
        
        if (participantData.length < raidData.minPlayers) {
          console.warn(`[Raid Matchmaking] Not enough valid heroes: ${participantData.length} < ${raidData.minPlayers}`);
          return;
        }
        
        // Extract participant IDs for querying
        const participantUserIds = participantData.map(p => p.userId).filter(Boolean);
        
        // Use first member as organizer
        const organizerId = allGroupMembers[0].userId;
        
        // Create raid instance
        const raidInstance = {
          raidId: raidData.id,
          difficulty: raidData.difficulty,
          status: 'in_progress',
          organizerId: organizerId,
          participants: participantData,
          participantIds: participantUserIds,
          currentWave: 0,
          waves: raidData.waves || 5,
          waveEnemies: raidData.waveEnemies || [],
          boss: {
            name: raidData.boss.name,
            hp: raidData.boss.hp,
            maxHp: raidData.boss.hp,
            attack: raidData.boss.attack,
            defense: raidData.boss.defense || 0,
            level: raidData.boss.level,
            xp: raidData.boss.xp || 1000
          },
          combatLog: [],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const instanceRef = await db.collection('raidInstances').add(raidInstance);
        
        console.log(`[Raid Matchmaking] 🏰 Created raid instance ${instanceRef.id} for group: ${raidData.name} (${participantData.length} players)`);
        
        // Update all heroes to have activeInstance pointing to this raid
        const participantHeroIds = participantData.map(p => p.heroId);
        const updatePromises = participantHeroIds.map(async (heroId) => {
          try {
            await db.collection('heroes').doc(heroId).update({
              activeInstance: {
                type: 'raid',
                instanceId: instanceRef.id
              },
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            console.error(`[Raid Matchmaking] Failed to update hero ${heroId} with active instance:`, error);
          }
        });
        
        await Promise.all(updatePromises);
        console.log(`[Raid Matchmaking] ✅ Updated all ${participantData.length} heroes with active raid instance`);
        
        console.log(`✅ Raid group formed for ${raidId}: ${requiredTanks} tanks, ${requiredHealers} healers, ${requiredDps} DPS`);
      } catch (err) {
        console.error('Error creating raid instance from matchmaking:', err);
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

export default router;
