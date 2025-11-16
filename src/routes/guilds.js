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
    res.status(500).json({ error: 'Failed to create guild' });
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

// Join guild
router.post('/:guildId/join', async (req, res) => {
  try {
    const { userId } = req.body;
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
    
    await guildRef.update({
      memberIds: admin.firestore.FieldValue.arrayUnion(userId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({ success: true, message: 'Joined guild successfully' });
  } catch (error) {
    console.error('Error joining guild:', error);
    res.status(500).json({ error: 'Failed to join guild' });
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

export default router;
