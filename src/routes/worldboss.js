import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Get active world boss
router.get('/active', async (req, res) => {
  try {
    const snapshot = await db.collection('worldBoss')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      // Check for upcoming boss
      try {
        const upcomingSnapshot = await db.collection('worldBoss')
          .where('status', '==', 'upcoming')
          .orderBy('scheduledTime', 'asc')
          .limit(1)
          .get();
        
        if (upcomingSnapshot.empty) {
          return res.json({ worldBoss: null, message: 'No active or upcoming world boss' });
        }
        
        const upcomingBoss = { id: upcomingSnapshot.docs[0].id, ...upcomingSnapshot.docs[0].data() };
        return res.json({ worldBoss: upcomingBoss, status: 'upcoming' });
      } catch (indexError) {
        // Index might not exist yet, return null
        console.warn('World boss index not created yet or no world bosses exist');
        return res.json({ worldBoss: null, message: 'No world bosses configured' });
      }
    }
    
    const worldBoss = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    res.json({ worldBoss, status: 'active' });
  } catch (error) {
    console.error('Error fetching active world boss:', error);
    // Return null instead of error to avoid breaking the frontend
    res.json({ worldBoss: null, message: 'No world bosses available' });
  }
});

// Get world boss by ID
router.get('/:bossId', async (req, res) => {
  try {
    const doc = await db.collection('worldBoss').doc(req.params.bossId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'World boss not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching world boss:', error);
    res.status(500).json({ error: 'Failed to fetch world boss' });
  }
});

// Join world boss fight
router.post('/:bossId/join', async (req, res) => {
  try {
    const { bossId } = req.params;
    const { userId, username, heroLevel, heroRole } = req.body;
    
    if (!userId || !username || !heroLevel || !heroRole) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const bossRef = db.collection('worldBoss').doc(bossId);
    const doc = await bossRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'World boss not found' });
    }
    
    const boss = doc.data();
    
    if (boss.status === 'completed') {
      return res.status(400).json({ error: 'World boss is already defeated' });
    }
    
    // Check if player is already participating
    const existingParticipant = boss.participants?.find(p => p.userId === userId);
    if (existingParticipant) {
      return res.json({ 
        success: true, 
        message: 'Already joined',
        participant: existingParticipant
      });
    }
    
    const participant = {
      userId,
      username,
      heroLevel,
      heroRole,
      damageDealt: 0,
      healingDone: 0,
      damageBlocked: 0,
      joinedAt: Date.now()
    };
    
    await bossRef.update({
      participants: admin.firestore.FieldValue.arrayUnion(participant),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Joined world boss fight', participant });
  } catch (error) {
    console.error('Error joining world boss:', error);
    res.status(500).json({ error: 'Failed to join world boss' });
  }
});

// Submit damage/healing to world boss
router.post('/:bossId/damage', async (req, res) => {
  try {
    const { bossId } = req.params;
    const { userId, damageDealt, healingDone, damageBlocked, newHp } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    
    const bossRef = db.collection('worldBoss').doc(bossId);
    const doc = await bossRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'World boss not found' });
    }
    
    const boss = doc.data();
    
    if (boss.status !== 'active') {
      return res.status(400).json({ error: 'World boss is not active' });
    }
    
    // Update participant stats
    const participants = boss.participants || [];
    const participantIndex = participants.findIndex(p => p.userId === userId);
    
    if (participantIndex === -1) {
      return res.status(404).json({ error: 'Participant not found. Join the fight first.' });
    }
    
    participants[participantIndex].damageDealt += (damageDealt || 0);
    participants[participantIndex].healingDone += (healingDone || 0);
    participants[participantIndex].damageBlocked += (damageBlocked || 0);
    
    // Update boss HP if provided
    const updateData = {
      participants: participants,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (newHp !== undefined) {
      updateData.hp = Math.max(0, newHp);
      
      // Check if boss is defeated
      if (newHp <= 0) {
        updateData.status = 'completed';
        updateData.results = {
          winners: participants.sort((a, b) => b.damageDealt - a.damageDealt).slice(0, 10),
          totalDamage: participants.reduce((sum, p) => sum + p.damageDealt, 0),
          duration: Date.now() - boss.startedAt,
          completedAt: admin.firestore.FieldValue.serverTimestamp()
        };
      }
    }
    
    await bossRef.update(updateData);
    
    res.json({ 
      success: true, 
      bossHp: updateData.hp || boss.hp,
      defeated: updateData.status === 'completed'
    });
  } catch (error) {
    console.error('Error submitting world boss damage:', error);
    res.status(500).json({ error: 'Failed to submit damage' });
  }
});

// Get world boss leaderboard
router.get('/:bossId/leaderboard', async (req, res) => {
  try {
    const { bossId } = req.params;
    const { type = 'damage' } = req.query; // 'damage', 'healing', or 'tanking'
    
    const doc = await db.collection('worldBoss').doc(bossId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'World boss not found' });
    }
    
    const boss = doc.data();
    const participants = boss.participants || [];
    
    // Sort based on type
    let leaderboard;
    switch (type) {
      case 'healing':
        leaderboard = [...participants].sort((a, b) => b.healingDone - a.healingDone);
        break;
      case 'tanking':
        leaderboard = [...participants].sort((a, b) => b.damageBlocked - a.damageBlocked);
        break;
      case 'damage':
      default:
        leaderboard = [...participants].sort((a, b) => b.damageDealt - a.damageDealt);
        break;
    }
    
    // Take top 10
    const top10 = leaderboard.slice(0, 10).map((p, index) => ({
      rank: index + 1,
      userId: p.userId,
      username: p.username,
      heroLevel: p.heroLevel,
      heroRole: p.heroRole,
      damageDealt: p.damageDealt,
      healingDone: p.healingDone,
      damageBlocked: p.damageBlocked
    }));
    
    res.json({ 
      leaderboard: top10,
      type,
      totalParticipants: participants.length
    });
  } catch (error) {
    console.error('Error fetching world boss leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Complete world boss and distribute rewards
router.post('/:bossId/complete', async (req, res) => {
  try {
    const { bossId } = req.params;
    
    const bossRef = db.collection('worldBoss').doc(bossId);
    const doc = await bossRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'World boss not found' });
    }
    
    const boss = doc.data();
    
    if (boss.status === 'completed') {
      return res.status(400).json({ error: 'World boss is already completed' });
    }
    
    if (boss.hp > 0) {
      return res.status(400).json({ error: 'World boss is not defeated yet' });
    }
    
    const participants = boss.participants || [];
    
    // Sort by damage for rewards
    const sortedParticipants = [...participants].sort((a, b) => b.damageDealt - a.damageDealt);
    
    // Distribute rewards to top performers
    const rewardPromises = sortedParticipants.slice(0, 20).map(async (participant, index) => {
      const heroDoc = await db.collection('heroes').doc(participant.userId).get();
      
      if (heroDoc.exists) {
        const heroRef = heroDoc.ref;
        const hero = heroDoc.data();
        
        // Calculate rewards based on rank
        const rankMultiplier = index < 3 ? 2.0 : index < 10 ? 1.5 : 1.0;
        const goldReward = Math.floor(boss.rewards.gold * rankMultiplier);
        const tokenReward = Math.floor(boss.rewards.tokens * rankMultiplier);
        const xpReward = Math.floor(boss.rewards.xpBonus * rankMultiplier);
        
        await heroRef.update({
          gold: (hero.gold || 0) + goldReward,
          tokens: (hero.tokens || 0) + tokenReward,
          xp: (hero.xp || 0) + xpReward,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Top 3 get legendary loot
        if (index < 3) {
          const { generateRaidLoot } = await import('../data/raidLoot.js');
          
          // Determine category from role
          let category = 'dps';
          const roleConfig = {
            paladin: 'tank', warrior: 'tank', deathknight: 'tank',
            cleric: 'healer', druid: 'healer', shaman: 'healer',
            berserker: 'dps', mage: 'dps', hunter: 'dps', rogue: 'dps',
            stormcaller: 'dps', dragonsorcerer: 'dps'
          };
          
          if (participant.heroRole) {
            const role = participant.heroRole.toLowerCase();
            category = roleConfig[role] || 'dps';
          }
          
          const slots = ['weapon', 'armor', 'accessory'];
          const randomSlot = slots[Math.floor(Math.random() * slots.length)];
          
          const item = generateRaidLoot(
            'world_boss_' + boss.name.toLowerCase().replace(/\s+/g, '_'),
            'mythic',
            category,
            randomSlot,
            boss.level || 60
          );
          
          if (item) {
            const inventory = hero.inventory || [];
            inventory.push(item);
            
            await heroRef.update({
              inventory: inventory,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
    });
    
    await Promise.all(rewardPromises);
    
    // Mark boss as completed
    await bossRef.update({
      status: 'completed',
      results: {
        winners: sortedParticipants.slice(0, 10),
        totalDamage: participants.reduce((sum, p) => sum + p.damageDealt, 0),
        totalHealing: participants.reduce((sum, p) => sum + p.healingDone, 0),
        duration: Date.now() - (boss.startedAt || Date.now()),
        completedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'World boss defeated! Rewards distributed.',
      winners: sortedParticipants.slice(0, 10)
    });
  } catch (error) {
    console.error('Error completing world boss:', error);
    res.status(500).json({ error: 'Failed to complete world boss' });
  }
});

// Create a new world boss event (admin only - for testing)
router.post('/create', async (req, res) => {
  try {
    const { name, hp, attack, level, mechanics, duration, rewards } = req.body;
    
    const worldBoss = {
      name: name || 'Test World Boss',
      hp: hp || 1000000,
      maxHp: hp || 1000000,
      attack: attack || 300,
      level: level || 60,
      mechanics: mechanics || ['Enrage at 20%', 'AoE damage every 30s'],
      scheduledTime: admin.firestore.FieldValue.serverTimestamp(),
      duration: duration || 3600000, // 1 hour
      rewards: rewards || {
        gold: 5000,
        tokens: 100,
        guaranteedLoot: 'legendary',
        xpBonus: 50000
      },
      participants: [],
      status: 'active',
      startedAt: Date.now(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const bossRef = await db.collection('worldBoss').add(worldBoss);
    
    res.json({
      success: true,
      bossId: bossRef.id,
      message: 'World boss created successfully'
    });
  } catch (error) {
    console.error('Error creating world boss:', error);
    res.status(500).json({ error: 'Failed to create world boss' });
  }
});

export default router;
