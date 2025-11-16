import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Get all raids
router.get('/', async (req, res) => {
  try {
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
    
    res.json(raids);
  } catch (error) {
    console.error('Error fetching raids:', error);
    res.status(500).json({ error: 'Failed to fetch raids' });
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
    
    await doc.ref.update({
      participants: admin.firestore.FieldValue.arrayUnion(participant),
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
    
    // Get user's hero by document ID
    const heroDoc = await db.collection('heroes').doc(userId).get();
    
    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = heroDoc.data();
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
    
    // Import raid data - get ALL raids, not just available ones
    const { RAIDS } = await import('../data/raids.js');
    const allRaids = Object.values(RAIDS);
    
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
    const { participants } = req.body; // Array of userId strings
    
    if (!participants || !Array.isArray(participants) || participants.length === 0) {
      return res.status(400).json({ error: 'Participants array is required' });
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
    const heroPromises = participants.map(userId => 
      db.collection('heroes').doc(userId).get()
    );
    
    const heroDocs = await Promise.all(heroPromises);
    const participantData = [];
    
    for (let i = 0; i < heroDocs.length; i++) {
      const heroDoc = heroDocs[i];
      if (!heroDoc.exists) {
        return res.status(404).json({ error: `Hero not found for user ${participants[i]}` });
      }
      
      const hero = heroDoc.data();
      
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
      
      participantData.push({
        userId: hero.id,
        username: hero.name,
        heroName: hero.name,
        heroLevel: hero.level,
        heroRole: hero.role,
        itemScore: itemScore,
        damageDealt: 0,
        healingDone: 0,
        damageTaken: 0,
        deaths: 0,
        isAlive: true
      });
    }
    
    // Create raid instance
    const raidInstance = {
      raidId: raidData.id,
      difficulty: raidData.difficulty,
      status: 'starting',
      currentWave: 0,
      maxWaves: raidData.waves,
      bossHp: raidData.boss.hp,
      bossMaxHp: raidData.boss.hp,
      participants: participantData,
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
    const { wave, participants, combatLogEntries } = req.body;
    
    const instanceRef = db.collection('raidInstances').doc(instanceId);
    const doc = await instanceRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Raid instance not found' });
    }
    
    const instance = doc.data();
    
    if (instance.status === 'completed' || instance.status === 'failed') {
      return res.status(400).json({ error: 'Raid instance is already finished' });
    }
    
    // Update instance
    await instanceRef.update({
      currentWave: wave,
      participants: participants,
      combatLog: admin.firestore.FieldValue.arrayUnion(...combatLogEntries),
      status: wave >= instance.maxWaves ? 'in-progress' : 'in-progress',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: `Wave ${wave} completed`,
      isBossFight: wave >= instance.maxWaves
    });
  } catch (error) {
    console.error('Error updating raid progress:', error);
    res.status(500).json({ error: 'Failed to update raid progress' });
  }
});

// Get raid instance status
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
      await instanceRef.update({
        status: 'failed',
        participants: finalParticipants,
        combatLog: finalCombatLog,
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
    const { ROLE_CONFIG } = await import('../../IdleDnD/game.js');
    
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
    await instanceRef.update({
      status: 'completed',
      participants: finalParticipants,
      combatLog: finalCombatLog,
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

// Get upcoming scheduled raids (next 24 hours)
router.get('/upcoming', async (req, res) => {
  try {
    const now = new Date();
    const next24Hours = new Date(now.getTime() + (24 * 60 * 60 * 1000));
    
    const snapshot = await db.collection('raidInstances')
      .where('status', '==', 'scheduled')
      .where('startedAt', '>=', now)
      .where('startedAt', '<=', next24Hours)
      .orderBy('startedAt', 'asc')
      .get();
    
    const scheduledRaids = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json({ scheduledRaids });
  } catch (error) {
    console.error('Error fetching upcoming raids:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming raids' });
  }
});

// Schedule a raid (guild feature)
router.post('/schedule', async (req, res) => {
  try {
    const { raidId, guildId, scheduledTime, participants } = req.body;
    
    if (!raidId || !scheduledTime || !participants || participants.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
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

// Join PUG queue for a raid
router.post('/queue/:raidId/join', async (req, res) => {
  try {
    const { raidId } = req.params;
    const { userId, heroName, heroLevel, heroRole, itemScore } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    // Import raid data
    const { getRaidById } = await import('../data/raids.js');
    const raidData = getRaidById(raidId);
    
    if (!raidData) {
      return res.status(404).json({ error: 'Raid not found' });
    }
    
    // Check if user meets requirements
    if (heroLevel < raidData.minLevel || itemScore < raidData.minItemScore) {
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
      return res.json({ success: true, message: 'Already in queue', position: queue.participants.findIndex(p => p.userId === userId) + 1 });
    }
    
    // Add to queue
    const participant = {
      userId,
      heroName,
      heroLevel,
      heroRole,
      itemScore,
      joinedAt: Date.now()
    };
    
    queue.participants.push(participant);
    
    await queueRef.set({
      ...queue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Check if queue is full - auto-start raid
    if (queue.participants.length >= raidData.minPlayers) {
      // Start raid immediately
      const participants = queue.participants.slice(0, raidData.maxPlayers).map(p => p.userId);
      
      // Create raid instance (reuse existing start logic)
      const startResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/raids/${raidId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participants })
      });
      
      if (startResponse.ok) {
        // Clear queue
        await queueRef.delete();
        
        const startData = await startResponse.json();
        return res.json({
          success: true,
          message: 'Queue full! Raid starting now!',
          instanceId: startData.instanceId,
          autoStarted: true
        });
      }
    }
    
    res.json({
      success: true,
      message: 'Added to queue',
      position: queue.participants.length,
      queueSize: queue.participants.length,
      spotsRemaining: raidData.minPlayers - queue.participants.length
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
    
    const queueDoc = await db.collection('raidQueues').doc(raidId).get();
    
    if (!queueDoc.exists) {
      return res.json({ 
        queueSize: 0, 
        participants: [],
        message: 'No one in queue yet'
      });
    }
    
    const queue = queueDoc.data();
    
    res.json({
      queueSize: queue.participants.length,
      participants: queue.participants,
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
    queue.participants = queue.participants.filter(p => p.userId !== userId);
    
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

export default router;
