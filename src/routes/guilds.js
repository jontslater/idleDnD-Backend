import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Get all guilds
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('guilds').get();
    const guilds = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(guilds);
  } catch (error) {
    console.error('Error fetching guilds:', error);
    res.status(500).json({ error: 'Failed to fetch guilds' });
  }
});

// Get guild by ID
router.get('/:guildId', async (req, res) => {
  try {
    const doc = await db.collection('guilds').doc(req.params.guildId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching guild:', error);
    res.status(500).json({ error: 'Failed to fetch guild' });
  }
});

// Get user's guild
router.get('/member/:userId', async (req, res) => {
  try {
    const snapshot = await db.collection('guilds')
      .where('memberIds', 'array-contains', req.params.userId)
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      return res.json(null);
    }
    
    const doc = snapshot.docs[0];
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error fetching user guild:', error);
    res.status(500).json({ error: 'Failed to fetch guild' });
  }
});

// Create new guild
router.post('/', async (req, res) => {
  try {
    if (!req.body.createdBy) {
      return res.status(400).json({ error: 'createdBy is required' });
    }
    
    const guildData = {
      ...req.body,
      memberIds: [req.body.createdBy],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('guilds').add(guildData);
    const doc = await docRef.get();
    
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Error creating guild:', error);
    res.status(500).json({ error: 'Failed to create guild', details: error.message });
  }
});

// Update guild
router.put('/:guildId', async (req, res) => {
  try {
    const guildRef = db.collection('guilds').doc(req.params.guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await guildRef.update(updateData);
    const updated = await guildRef.get();
    
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Error updating guild:', error);
    res.status(500).json({ error: 'Failed to update guild' });
  }
});

// Join guild (auto-join if open, or create application if approval required)
router.post('/:guildId/join', async (req, res) => {
  try {
    const { userId, username, message } = req.body;
    const guildRef = db.collection('guilds').doc(req.params.guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if already a member
    if (guild.memberIds?.includes(userId)) {
      return res.status(400).json({ error: 'Already a guild member' });
    }
    
    // Check if guild is full
    if (guild.memberIds?.length >= guild.maxMembers) {
      return res.status(400).json({ error: 'Guild is full' });
    }
    
    const joinMode = guild.joinMode || 'open';
    
    if (joinMode === 'open') {
      // Auto-join
      await guildRef.update({
        memberIds: admin.firestore.FieldValue.arrayUnion(userId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ success: true, message: 'Joined guild successfully' });
    } else {
      // Approval required - create application
      const pendingApplications = guild.pendingApplications || [];
      
      // Check if already applied
      if (pendingApplications.some(app => app.userId === userId)) {
        return res.status(400).json({ error: 'Application already pending' });
      }
      
      pendingApplications.push({
        userId,
        username: username || 'Unknown',
        appliedAt: admin.firestore.Timestamp.now(),
        message: message || ''
      });
      
      await guildRef.update({
        pendingApplications,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ success: true, message: 'Application submitted' });
    }
  } catch (error) {
    console.error('Error joining guild:', error);
    res.status(500).json({ error: 'Failed to join guild' });
  }
});

// Apply to join guild (explicit application)
router.post('/:guildId/apply', async (req, res) => {
  try {
    const { userId, username, message } = req.body;
    const guildRef = db.collection('guilds').doc(req.params.guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    if (guild.memberIds?.includes(userId)) {
      return res.status(400).json({ error: 'Already a guild member' });
    }
    
    const pendingApplications = guild.pendingApplications || [];
    
    if (pendingApplications.some(app => app.userId === userId)) {
      return res.status(400).json({ error: 'Application already pending' });
    }
    
    pendingApplications.push({
      userId,
      username: username || 'Unknown',
      appliedAt: admin.firestore.Timestamp.now(),
      message: message || ''
    });
    
    await guildRef.update({
      pendingApplications,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Application submitted' });
  } catch (error) {
    console.error('Error applying to guild:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Approve application (leader/officer only)
router.post('/:guildId/approve/:userId', async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { approverId } = req.body;
    
    const guildRef = db.collection('guilds').doc(guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if approver is leader or officer
    const approverMember = guild.members?.find(m => m.userId === approverId);
    if (!approverMember || (approverMember.rank !== 'leader' && approverMember.rank !== 'officer')) {
      return res.status(403).json({ error: 'Not authorized to approve applications' });
    }
    
    // Find and remove application
    const pendingApplications = guild.pendingApplications || [];
    const application = pendingApplications.find(app => app.userId === userId);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (guild.memberIds?.includes(userId)) {
      return res.status(400).json({ error: 'User is already a member' });
    }
    
    if (guild.memberIds?.length >= guild.maxMembers) {
      return res.status(400).json({ error: 'Guild is full' });
    }
    
    // Remove from pending applications
    const updatedApplications = pendingApplications.filter(app => app.userId !== userId);
    
    // Add to members
    await guildRef.update({
      memberIds: admin.firestore.FieldValue.arrayUnion(userId),
      pendingApplications: updatedApplications,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Application approved' });
  } catch (error) {
    console.error('Error approving application:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  }
});

// Reject application
router.post('/:guildId/reject/:userId', async (req, res) => {
  try {
    const { guildId, userId } = req.params;
    const { approverId } = req.body;
    
    const guildRef = db.collection('guilds').doc(guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if approver is leader or officer
    const approverMember = guild.members?.find(m => m.userId === approverId);
    if (!approverMember || (approverMember.rank !== 'leader' && approverMember.rank !== 'officer')) {
      return res.status(403).json({ error: 'Not authorized to reject applications' });
    }
    
    const pendingApplications = guild.pendingApplications || [];
    const updatedApplications = pendingApplications.filter(app => app.userId !== userId);
    
    await guildRef.update({
      pendingApplications: updatedApplications,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Application rejected' });
  } catch (error) {
    console.error('Error rejecting application:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

// Update guild settings
router.put('/:guildId/settings', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId, joinMode } = req.body;
    
    const guildRef = db.collection('guilds').doc(guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if user is leader
    if (guild.createdBy !== userId) {
      return res.status(403).json({ error: 'Only guild leader can update settings' });
    }
    
    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (joinMode && (joinMode === 'open' || joinMode === 'approval')) {
      updates.joinMode = joinMode;
    }
    
    await guildRef.update(updates);
    const updated = await guildRef.get();
    
    res.json({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('Error updating guild settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Assign loot to member
router.post('/:guildId/loot/assign', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { userId, itemId, assignedTo } = req.body;
    
    const guildRef = db.collection('guilds').doc(guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if user is leader or officer
    const userMember = guild.members?.find(m => m.userId === userId);
    if (!userMember || (userMember.rank !== 'leader' && userMember.rank !== 'officer')) {
      return res.status(403).json({ error: 'Not authorized to assign loot' });
    }
    
    const guildLoot = guild.guildLoot || [];
    const lootItem = guildLoot.find(l => l.item?.id === itemId);
    
    if (!lootItem) {
      return res.status(404).json({ error: 'Loot item not found' });
    }
    
    if (lootItem.assignedTo) {
      return res.status(400).json({ error: 'Loot already assigned' });
    }
    
    // Check assignedTo is a participant
    if (!lootItem.participants?.includes(assignedTo)) {
      return res.status(400).json({ error: 'User did not participate in this activity' });
    }
    
    // Remove from guild loot and add to history
    const updatedLoot = guildLoot.filter(l => l.item?.id !== itemId);
    const lootHistory = guild.lootHistory || [];
    
    lootHistory.push({
      item: lootItem.item,
      assignedTo,
      assignedBy: userId,
      assignedAt: admin.firestore.Timestamp.now()
    });
    
    // Add item to assigned user's inventory
    const memberRef = db.collection('heroes').doc(assignedTo);
    const memberDoc = await memberRef.get();
    
    if (memberDoc.exists) {
      const member = memberDoc.data();
      const inventory = member.inventory || [];
      inventory.push(lootItem.item);
      
      await memberRef.update({
        inventory,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    await guildRef.update({
      guildLoot: updatedLoot,
      lootHistory: lootHistory.slice(-100), // Keep last 100
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Loot assigned' });
  } catch (error) {
    console.error('Error assigning loot:', error);
    res.status(500).json({ error: 'Failed to assign loot' });
  }
});

// Get unassigned loot
router.get('/:guildId/loot', async (req, res) => {
  try {
    const { guildId } = req.params;
    const doc = await db.collection('guilds').doc(guildId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    const unassignedLoot = (guild.guildLoot || []).filter(l => !l.assignedTo);
    
    res.json(unassignedLoot);
  } catch (error) {
    console.error('Error fetching guild loot:', error);
    res.status(500).json({ error: 'Failed to fetch loot' });
  }
});

// Get loot history
router.get('/:guildId/loot/history', async (req, res) => {
  try {
    const { guildId } = req.params;
    const doc = await db.collection('guilds').doc(guildId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    const history = guild.lootHistory || [];
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching loot history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Leave guild
router.post('/:guildId/leave', async (req, res) => {
  try {
    const { userId } = req.body;
    const guildRef = db.collection('guilds').doc(req.params.guildId);
    
    await guildRef.update({
      memberIds: admin.firestore.FieldValue.arrayRemove(userId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Left guild successfully' });
  } catch (error) {
    console.error('Error leaving guild:', error);
    res.status(500).json({ error: 'Failed to leave guild' });
  }
});

// Get guild members with their heroes
router.get('/:guildId/members-with-heroes', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const guildDoc = await db.collection('guilds').doc(guildId).get();
    
    if (!guildDoc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = guildDoc.data();
    const memberIds = guild.memberIds || [];
    
    // Fetch heroes for all members in parallel
    const heroPromises = memberIds.map(async (userId) => {
      try {
        const heroDoc = await db.collection('heroes').doc(userId).get();
        
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
            return {
              userId,
              username: heroes[0].name || 'Unknown',
              hero: heroes[0]
            };
          }
        }
        
        if (heroDoc.exists) {
          const heroData = heroDoc.data();
          return {
            userId,
            username: heroData.name || 'Unknown',
            hero: { ...heroData, id: heroDoc.id }
          };
        }
        
        // No hero found
        return {
          userId,
          username: 'Unknown',
          hero: null
        };
      } catch (error) {
        console.error(`Error fetching hero for user ${userId}:`, error);
        return {
          userId,
          username: 'Unknown',
          hero: null
        };
      }
    });
    
    const members = await Promise.all(heroPromises);
    
    res.json({ members });
  } catch (error) {
    console.error('Error fetching guild members with heroes:', error);
    res.status(500).json({ error: 'Failed to fetch guild members' });
  }
});

export default router;
