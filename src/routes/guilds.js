import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Guild invite system
// Store invites in a separate collection: guildInvites
// Structure: { id, guildId, inviterHeroId, inviterHeroName, inviteeHeroId, inviteeHeroName, status: 'pending'|'accepted'|'declined', createdAt, expiresAt }

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

// Get guild for a member (accepts hero ID or user ID - guilds store hero IDs in memberIds)
router.get('/member/:userId', async (req, res) => {
  try {
    const userId = req.params.userId; // Can be hero ID or user ID
    
    // Try exact match first
    let snapshot = await db.collection('guilds')
      .where('memberIds', 'array-contains', userId)
      .limit(1)
      .get();
    
    // If not found, try as string (in case IDs are stored as numbers or vice versa)
    if (snapshot.empty) {
      const userIdAsString = String(userId);
      const userIdAsNumber = !isNaN(userId) ? Number(userId) : null;
      
      // Try string version
      if (userIdAsString !== userId) {
        snapshot = await db.collection('guilds')
          .where('memberIds', 'array-contains', userIdAsString)
          .limit(1)
          .get();
      }
      
      // Try number version if applicable
      if (snapshot.empty && userIdAsNumber !== null) {
        snapshot = await db.collection('guilds')
          .where('memberIds', 'array-contains', userIdAsNumber)
          .limit(1)
          .get();
      }
    }
    
    if (snapshot.empty) {
      console.log(`[Guilds] No guild found for userId: ${userId}`);
      return res.json(null);
    }
    
    const doc = snapshot.docs[0];
    const guildData = { id: doc.id, ...doc.data() };
    console.log(`[Guilds] Found guild for userId ${userId}:`, { guildId: doc.id, memberIds: guildData.memberIds });
    res.json(guildData);
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
      memberIds: [req.body.createdBy], // Store hero ID
      joinMode: req.body.joinMode || 'open', // Default to open, can be 'open' or 'approval'
      pendingApplications: [], // Initialize empty applications array
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
// Uses heroId since guilds are per-hero, not per-user
router.post('/:guildId/join', async (req, res) => {
  try {
    const { heroId, heroName, heroRole, heroLevel, message } = req.body;
    const guildRef = db.collection('guilds').doc(req.params.guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    if (!heroId) {
      return res.status(400).json({ error: 'heroId is required' });
    }
    
    const guild = doc.data();
    
    // Check if already a member (guilds store hero IDs in memberIds)
    if (guild.memberIds?.includes(heroId)) {
      return res.status(400).json({ error: 'This hero is already a guild member' });
    }
    
    // Check if guild is full
    if (guild.memberIds?.length >= guild.maxMembers) {
      return res.status(400).json({ error: 'Guild is full' });
    }
    
    const joinMode = guild.joinMode || 'open';
    
    if (joinMode === 'open') {
      // Auto-join
      await guildRef.update({
        memberIds: admin.firestore.FieldValue.arrayUnion(heroId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      res.json({ success: true, message: 'Joined guild successfully' });
    } else {
      // Approval required - create application
      const pendingApplications = guild.pendingApplications || [];
      
      // Check if already applied (by heroId)
      if (pendingApplications.some(app => app.heroId === heroId)) {
        return res.status(400).json({ error: 'Application already pending' });
      }
      
      pendingApplications.push({
        heroId,
        heroName: heroName || 'Unknown',
        heroRole: heroRole || 'berserker',
        heroLevel: heroLevel || 1,
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
// Uses heroId since guilds are per-hero, not per-user
router.post('/:guildId/apply', async (req, res) => {
  try {
    const { heroId, heroName, heroRole, heroLevel, message } = req.body;
    const guildRef = db.collection('guilds').doc(req.params.guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    if (!heroId) {
      return res.status(400).json({ error: 'heroId is required' });
    }
    
    const guild = doc.data();
    
    if (guild.memberIds?.includes(heroId)) {
      return res.status(400).json({ error: 'This hero is already a guild member' });
    }
    
    const pendingApplications = guild.pendingApplications || [];
    
    if (pendingApplications.some(app => app.heroId === heroId)) {
      return res.status(400).json({ error: 'Application already pending' });
    }
    
    pendingApplications.push({
      heroId,
      heroName: heroName || 'Unknown',
      heroRole: heroRole || 'berserker',
      heroLevel: heroLevel || 1,
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
// Uses heroId since guilds are per-hero
router.post('/:guildId/approve/:heroId', async (req, res) => {
  try {
    const { guildId, heroId } = req.params;
    const { approverHeroId } = req.body; // Hero ID of the approver
    
    const guildRef = db.collection('guilds').doc(guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if approver is the guild leader (createdBy stores the hero ID who created the guild)
    if (guild.createdBy !== approverHeroId) {
      return res.status(403).json({ error: 'Only the guild leader can approve applications' });
    }
    
    // Find and remove application
    const pendingApplications = guild.pendingApplications || [];
    const application = pendingApplications.find(app => app.heroId === heroId);
    
    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    
    if (guild.memberIds?.includes(heroId)) {
      return res.status(400).json({ error: 'This hero is already a member' });
    }
    
    if (guild.memberIds?.length >= guild.maxMembers) {
      return res.status(400).json({ error: 'Guild is full' });
    }
    
    // Remove from pending applications
    const updatedApplications = pendingApplications.filter(app => app.heroId !== heroId);
    
    // Add to members (using heroId)
    await guildRef.update({
      memberIds: admin.firestore.FieldValue.arrayUnion(heroId),
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
// Uses heroId since guilds are per-hero
router.post('/:guildId/reject/:heroId', async (req, res) => {
  try {
    const { guildId, heroId } = req.params;
    const { approverHeroId } = req.body; // Hero ID of the approver
    
    const guildRef = db.collection('guilds').doc(guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if approver is the guild leader (createdBy stores the hero ID who created the guild)
    if (guild.createdBy !== approverHeroId) {
      return res.status(403).json({ error: 'Only the guild leader can reject applications' });
    }
    
    const pendingApplications = guild.pendingApplications || [];
    const updatedApplications = pendingApplications.filter(app => app.heroId !== heroId);
    
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
// Uses heroId since guilds are per-hero
router.put('/:guildId/settings', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { heroId, joinMode } = req.body;
    
    const guildRef = db.collection('guilds').doc(guildId);
    const doc = await guildRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = doc.data();
    
    // Check if hero is leader (createdBy stores the hero ID who created the guild)
    if (guild.createdBy !== heroId) {
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
// Uses heroId since guilds are per-hero
router.post('/:guildId/leave', async (req, res) => {
  try {
    const { heroId } = req.body;
    const guildRef = db.collection('guilds').doc(req.params.guildId);
    
    if (!heroId) {
      return res.status(400).json({ error: 'heroId is required' });
    }
    
    await guildRef.update({
      memberIds: admin.firestore.FieldValue.arrayRemove(heroId),
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
    const heroPromises = memberIds.map(async (heroId) => {
      try {
        console.log(`[Guild Members] Fetching hero for heroId: ${heroId}`);
        const heroDoc = await db.collection('heroes').doc(heroId).get();
        
        let heroData = null;
        let heroDocId = heroId;
        
        if (heroDoc.exists) {
          heroData = heroDoc.data();
          heroDocId = heroDoc.id;
          console.log(`[Guild Members] Found hero by doc ID: ${heroDocId}, name: ${heroData?.name}, role: ${heroData?.role}, level: ${heroData?.level}`);
        } else {
          console.log(`[Guild Members] Hero not found by doc ID, trying twitchUserId lookup for: ${heroId}`);
          // If not found by document ID, try to find by Twitch user ID
          const snapshot = await db.collection('heroes')
            .where('twitchUserId', '==', heroId)
            .get();
          
          if (!snapshot.empty) {
            console.log(`[Guild Members] Found ${snapshot.docs.length} heroes by twitchUserId`);
            // Get the most recently updated hero
            let heroes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
            heroes.sort((a, b) => {
              const aTime = a.updatedAt?.toMillis?.() ?? new Date(a.updatedAt ?? 0).getTime();
              const bTime = b.updatedAt?.toMillis?.() ?? new Date(b.updatedAt ?? 0).getTime();
              return bTime - aTime;
            });
            heroData = heroes[0];
            heroDocId = heroes[0].id;
            console.log(`[Guild Members] Using hero: ${heroDocId}, name: ${heroData?.name}, role: ${heroData?.role}, level: ${heroData?.level}`);
          } else {
            console.log(`[Guild Members] No hero found for heroId: ${heroId}`);
          }
        }
        
        if (!heroData) {
          console.log(`[Guild Members] Returning default data for heroId: ${heroId}`);
          // No hero found
          return {
            userId: heroId,
            username: 'Unknown',
            rank: 'member',
            contributionPoints: 0,
            joinedAt: Date.now(),
            heroLevel: 1,
            heroRole: 'warrior',
            profession: null
          };
        }
        
        // Determine rank (leader if createdBy matches, otherwise member)
        const rank = guild.createdBy === heroId ? 'leader' : 'member';
        
        // Extract profession if available
        let profession = null;
        if (heroData.profession) {
          profession = {
            type: heroData.profession.type || 'herbalism',
            level: heroData.profession.level || 1
          };
        }
        
        // Handle joinedAt timestamp (use createdAt if available, otherwise current time)
        let joinedAt = Date.now();
        if (heroData.createdAt) {
          if (heroData.createdAt.toMillis) {
            joinedAt = heroData.createdAt.toMillis();
          } else if (heroData.createdAt.seconds) {
            joinedAt = heroData.createdAt.seconds * 1000;
          } else if (typeof heroData.createdAt === 'number') {
            joinedAt = heroData.createdAt;
          }
        }
        
        // Extract level and role with better handling
        const heroLevel = heroData.level !== undefined && heroData.level !== null 
          ? (typeof heroData.level === 'number' ? heroData.level : parseInt(heroData.level, 10))
          : 1;
        const heroRole = heroData.role || heroData.class || heroData.characterClass || 'warrior';
        const username = heroData.name || heroData.username || 'Unknown';
        
        console.log(`[Guild Members] Returning member data for ${username}: role=${heroRole}, level=${heroLevel}`);
        
        return {
          userId: heroId, // Using heroId as userId for consistency
          twitchUserId: heroData.twitchUserId || heroData.userId || null, // User's Twitch ID for party invites
          username,
          rank,
          contributionPoints: heroData.contributionPoints || 0,
          joinedAt,
          heroLevel,
          heroRole,
          profession
        };
      } catch (error) {
        console.error(`[Guild Members] Error fetching hero for heroId ${heroId}:`, error);
        return {
          userId: heroId,
          username: 'Unknown',
          rank: 'member',
          contributionPoints: 0,
          joinedAt: Date.now(),
          heroLevel: 1,
          heroRole: 'warrior',
          profession: null
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

// Create guild invite
// POST /api/guilds/:guildId/invite
// Body: { inviteeHeroId, inviteeHeroName, inviterHeroId, inviterHeroName }
router.post('/:guildId/invite', async (req, res) => {
  try {
    const { guildId } = req.params;
    const { inviteeHeroId, inviteeHeroName, inviterHeroId, inviterHeroName } = req.body;
    
    if (!inviteeHeroId || !inviterHeroId) {
      return res.status(400).json({ error: 'inviteeHeroId and inviterHeroId are required' });
    }
    
    const guildRef = db.collection('guilds').doc(guildId);
    const guildDoc = await guildRef.get();
    
    if (!guildDoc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = guildDoc.data();
    
    // Check if inviter is a member (and preferably leader/officer)
    if (!guild.memberIds?.includes(inviterHeroId)) {
      return res.status(403).json({ error: 'Only guild members can send invites' });
    }
    
    // For link-based invites, we use a placeholder inviteeHeroId
    const isLinkInvite = inviteeHeroId === 'link-invite-anyone';
    
    // Check if invitee is already a member (skip for link invites)
    if (!isLinkInvite && guild.memberIds?.includes(inviteeHeroId)) {
      return res.status(400).json({ error: 'Hero is already a guild member' });
    }
    
    // Check if guild is full
    if (guild.memberIds?.length >= guild.maxMembers) {
      return res.status(400).json({ error: 'Guild is full' });
    }
    
    // Check if there's already a pending invite (skip for link invites to allow multiple link invites)
    if (!isLinkInvite) {
      const existingInvite = await db.collection('guildInvites')
        .where('guildId', '==', guildId)
        .where('inviteeHeroId', '==', inviteeHeroId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();
      
      if (!existingInvite.empty) {
        return res.status(400).json({ error: 'Invite already pending for this hero' });
      }
    }
    
    // Create invite (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const inviteData = {
      guildId,
      guildName: guild.name,
      inviterHeroId,
      inviterHeroName: inviterHeroName || 'Unknown',
      inviteeHeroId,
      inviteeHeroName: inviteeHeroName || 'Unknown',
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt)
    };
    
    const inviteRef = await db.collection('guildInvites').add(inviteData);
    const inviteDoc = await inviteRef.get();
    
    console.log(`[Guild Invite] Created invite ${inviteDoc.id} for hero ${inviteeHeroId} to guild ${guildId}`);
    
    res.json({
      success: true,
      inviteId: inviteDoc.id,
      invite: { id: inviteDoc.id, ...inviteData }
    });
  } catch (error) {
    console.error('Error creating guild invite:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Get invite by ID
// GET /api/guilds/invite/:inviteId
router.get('/invite/:inviteId', async (req, res) => {
  try {
    const { inviteId } = req.params;
    const inviteDoc = await db.collection('guildInvites').doc(inviteId).get();
    
    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    
    const invite = { id: inviteDoc.id, ...inviteDoc.data() };
    
    // Check if expired
    if (invite.expiresAt) {
      const expiresAt = invite.expiresAt.toMillis ? invite.expiresAt.toMillis() : invite.expiresAt;
      if (Date.now() > expiresAt) {
        return res.status(400).json({ error: 'Invite has expired' });
      }
    }
    
    res.json(invite);
  } catch (error) {
    console.error('Error fetching invite:', error);
    res.status(500).json({ error: 'Failed to fetch invite' });
  }
});

// Accept guild invite
// POST /api/guilds/invite/:inviteId/accept
// Body: { heroId, heroName, heroRole, heroLevel }
router.post('/invite/:inviteId/accept', async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { heroId, heroName, heroRole, heroLevel } = req.body;
    
    if (!heroId) {
      return res.status(400).json({ error: 'heroId is required' });
    }
    
    const inviteDoc = await db.collection('guildInvites').doc(inviteId).get();
    
    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    
    const invite = inviteDoc.data();
    
    // For link-based invites (placeholder inviteeHeroId), allow any hero to accept
    // Otherwise, verify the hero matches the invitee
    const isLinkInvite = invite.inviteeHeroId === 'link-invite-anyone';
    if (!isLinkInvite && invite.inviteeHeroId !== heroId) {
      return res.status(403).json({ error: 'This invite is not for your hero' });
    }
    
    // Check if already accepted/declined
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: `Invite has already been ${invite.status}` });
    }
    
    // Check if expired
    if (invite.expiresAt) {
      const expiresAt = invite.expiresAt.toMillis ? invite.expiresAt.toMillis() : invite.expiresAt;
      if (Date.now() > expiresAt) {
        return res.status(400).json({ error: 'Invite has expired' });
      }
    }
    
    // Get guild
    const guildRef = db.collection('guilds').doc(invite.guildId);
    const guildDoc = await guildRef.get();
    
    if (!guildDoc.exists) {
      return res.status(404).json({ error: 'Guild not found' });
    }
    
    const guild = guildDoc.data();
    
    // Check if already a member
    if (guild.memberIds?.includes(heroId)) {
      // Mark invite as accepted anyway
      await inviteDoc.ref.update({ status: 'accepted', acceptedAt: admin.firestore.FieldValue.serverTimestamp() });
      return res.status(400).json({ error: 'Already a guild member' });
    }
    
    // Check if guild is full
    if (guild.memberIds?.length >= guild.maxMembers) {
      return res.status(400).json({ error: 'Guild is full' });
    }
    
    // Add to guild members
    await guildRef.update({
      memberIds: admin.firestore.FieldValue.arrayUnion(heroId),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Mark invite as accepted
    await inviteDoc.ref.update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Guild Invite] Hero ${heroId} accepted invite ${inviteId} to guild ${invite.guildId}`);
    
    res.json({ success: true, message: 'Joined guild successfully' });
  } catch (error) {
    console.error('Error accepting invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

// Get pending invites for a hero
// GET /api/guilds/invites/pending/:heroId
router.get('/invites/pending/:heroId', async (req, res) => {
  try {
    const { heroId } = req.params;
    
    const snapshot = await db.collection('guildInvites')
      .where('inviteeHeroId', '==', heroId)
      .where('status', '==', 'pending')
      .get();
    
    const invites = snapshot.docs
      .map(doc => {
        const data = doc.data();
        // Check if expired
        if (data.expiresAt) {
          const expiresAt = data.expiresAt.toMillis ? data.expiresAt.toMillis() : data.expiresAt;
          if (Date.now() > expiresAt) {
            return null; // Filter out expired invites
          }
        }
        return { id: doc.id, ...data };
      })
      .filter(invite => invite !== null);
    
    res.json({ invites });
  } catch (error) {
    console.error('Error fetching pending invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

// Get all invites for a guild (admin/leader view)
// GET /api/guilds/:guildId/invites
router.get('/:guildId/invites', async (req, res) => {
  try {
    const { guildId } = req.params;
    
    const snapshot = await db.collection('guildInvites')
      .where('guildId', '==', guildId)
      .where('status', '==', 'pending')
      .get();
    
    const invites = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json({ invites });
  } catch (error) {
    console.error('Error fetching guild invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

export default router;
