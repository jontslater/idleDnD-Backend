import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Party statuses
const PARTY_STATUS = {
  FORMING: 'forming',
  QUEUED: 'queued',
  IN_INSTANCE: 'in_instance',
  DISBANDED: 'disbanded'
};

// Party size limits
const PARTY_LIMITS = {
  dungeon: 5,
  raid: 20
};

/**
 * Create a new party
 * POST /api/parties/create
 */
router.post('/create', async (req, res) => {
  try {
    const { leaderId, leaderName, heroId, heroName, heroRole, heroLevel } = req.body;

    if (!leaderId || !heroId) {
      return res.status(400).json({ error: 'leaderId and heroId are required' });
    }

    // Check if user is already in a party
    const existingParty = await db.collection('parties')
      .where('members', 'array-contains', leaderId)
      .where('status', 'in', [PARTY_STATUS.FORMING, PARTY_STATUS.QUEUED])
      .limit(1)
      .get();

    if (!existingParty.empty) {
      return res.status(400).json({ 
        error: 'You are already in a party',
        partyId: existingParty.docs[0].id
      });
    }

    // Create party
    const partyData = {
      leaderId,
      members: [leaderId],
      memberData: [{
        userId: leaderId,
        username: leaderName || leaderId,
        heroId,
        heroName: heroName || 'Unknown',
        heroRole: heroRole || 'berserker',
        heroLevel: heroLevel || 1
      }],
      status: PARTY_STATUS.FORMING,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const partyRef = await db.collection('parties').add(partyData);
    const partyId = partyRef.id;

    console.log(`[Parties] Created party ${partyId} by leader ${leaderId}`);

    res.json({
      success: true,
      partyId,
      party: {
        id: partyId,
        ...partyData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    });

  } catch (error) {
    console.error('[Parties] Error creating party:', error);
    res.status(500).json({ error: 'Failed to create party' });
  }
});

/**
 * Search for users/heroes by Twitch username or hero name
 * GET /api/parties/search?username=xxx
 * NOTE: This must be defined BEFORE /:userId route to avoid route conflicts
 */
router.get('/search', async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || typeof username !== 'string') {
      return res.status(400).json({ error: 'username query parameter is required' });
    }

    const searchTerm = username.toLowerCase().trim();
    console.log(`[Parties Search] Searching for: "${searchTerm}"`);

    // Search heroes by Twitch username or hero name (case-insensitive partial match)
    // NOTE: This searches ALL heroes regardless of active status
    const heroesSnapshot = await db.collection('heroes').get();
    console.log(`[Parties Search] Total heroes in database: ${heroesSnapshot.docs.length}`);

    const matches = [];
    let checkedCount = 0;

    heroesSnapshot.docs.forEach(heroDoc => {
      checkedCount++;
      const hero = heroDoc.data();
      const twitchUsername = (hero.twitchUsername || '').toLowerCase();
      const usernameField = (hero.username || '').toLowerCase();
      const heroName = (hero.name || '').toLowerCase();
      // Get user ID - NEVER use hero.id (document ID) as userId for whispers/search
      // Only use actual user identifiers
      const userId = hero.twitchUserId || hero.userId || hero.ownerId;
      // Skip if no valid user ID found
      if (!userId) {
        return; // In forEach, use return to skip to next iteration
      }

      // Debug: Log all heroes that might match (for troubleshooting)
      if (searchTerm.includes('tehchno') || searchTerm.includes('techno')) {
        if (twitchUsername.includes('tech') || usernameField.includes('tech') || heroName.includes('tech')) {
          console.log(`[Parties Search] Potential match (checking):`, {
            heroId: heroDoc.id,
            twitchUsername: hero.twitchUsername,
            username: hero.username,
            name: hero.name,
            userId: userId,
            allFields: Object.keys(hero).filter(k => k.toLowerCase().includes('user') || k.toLowerCase().includes('name'))
          });
        }
      }

      // Match by twitch username or hero name
      const matchesSearch = 
        twitchUsername.includes(searchTerm) ||
        usernameField.includes(searchTerm) ||
        heroName.includes(searchTerm) ||
        twitchUsername.startsWith(searchTerm) ||
        usernameField.startsWith(searchTerm) ||
        heroName.startsWith(searchTerm);

      if (matchesSearch) {
        const displayUsername = hero.twitchUsername || hero.username || userId;

        // Debug log for specific search
        if (displayUsername.toLowerCase().includes('tehchno') || searchTerm.includes('tehchno') || searchTerm.includes('techno')) {
          console.log(`[Parties Search] ✅ MATCH FOUND for "${searchTerm}":`, {
            heroId: heroDoc.id,
            twitchUsername: hero.twitchUsername,
            username: hero.username,
            name: hero.name,
            userId: userId,
            displayUsername,
            allUsernameFields: {
              twitchUsername: hero.twitchUsername,
              username: hero.username,
              name: hero.name
            }
          });
        }

        matches.push({
          userId: userId || hero.twitchUserId || hero.userId || hero.ownerId, // Ensure we never use hero.id as userId
          twitchUserId: hero.twitchUserId || hero.userId || hero.ownerId, // Explicit twitchUserId field
          username: displayUsername,
          heroId: heroDoc.id,
          heroName: hero.name || 'Unknown',
          heroRole: hero.role || 'berserker',
          heroLevel: hero.level || 1
        });
      }
    });

    console.log(`[Parties Search] Checked ${checkedCount} heroes, found ${matches.length} matches`);

    // Sort by match quality: exact username/hero name, then startsWith, then contains
    matches.sort((a, b) => {
      const aUser = a.username.toLowerCase();
      const bUser = b.username.toLowerCase();
      const aHero = (a.heroName || '').toLowerCase();
      const bHero = (b.heroName || '').toLowerCase();

      const aExact = aUser === searchTerm || aHero === searchTerm;
      const bExact = bUser === searchTerm || bHero === searchTerm;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const aStarts = aUser.startsWith(searchTerm) || aHero.startsWith(searchTerm);
      const bStarts = bUser.startsWith(searchTerm) || bHero.startsWith(searchTerm);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      return aUser.localeCompare(bUser);
    });

    console.log(`[Parties Search] Found ${matches.length} matches for "${searchTerm}"`);

    res.json({
      success: true,
      matches: matches.slice(0, 20) // Limit to 20 results
    });

  } catch (error) {
    console.error('[Parties] Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

/**
 * Get user's current party
 * GET /api/parties/:userId
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const partySnapshot = await db.collection('parties')
      .where('members', 'array-contains', userId)
      .where('status', 'in', [PARTY_STATUS.FORMING, PARTY_STATUS.QUEUED, PARTY_STATUS.IN_INSTANCE])
      .limit(1)
      .get();

    if (partySnapshot.empty) {
      return res.json({
        success: true,
        party: null
      });
    }

    const partyDoc = partySnapshot.docs[0];
    const party = partyDoc.data();

    res.json({
      success: true,
      party: {
        id: partyDoc.id,
        ...party,
        createdAt: party.createdAt?.toMillis() || Date.now(),
        updatedAt: party.updatedAt?.toMillis() || Date.now()
      }
    });

  } catch (error) {
    console.error('[Parties] Error fetching party:', error);
    res.status(500).json({ error: 'Failed to fetch party' });
  }
});

/**
 * Invite player to party
 * POST /api/parties/:partyId/invite
 */
router.post('/:partyId/invite', async (req, res) => {
  try {
    const { partyId } = req.params;
    const { inviterId, inviteeId, inviteeName, heroId, heroName, heroRole, heroLevel } = req.body;

    if (!inviterId || !inviteeId) {
      return res.status(400).json({ error: 'inviterId and inviteeId are required' });
    }

    const partyRef = db.collection('parties').doc(partyId);
    const partyDoc = await partyRef.get();

    if (!partyDoc.exists) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyDoc.data();

    // Check if inviter is leader
    if (party.leaderId !== inviterId) {
      return res.status(403).json({ error: 'Only the party leader can invite members' });
    }

    // Normalize inviteeId - check if it's a hero ID and convert to user ID
    let actualInviteeUserId = String(inviteeId);
    let actualHeroId = heroId || inviteeId;
    let actualHeroName = heroName;
    let actualHeroRole = heroRole;
    let actualHeroLevel = heroLevel;
    
    // Check if inviteeId looks like a hero document ID (long alphanumeric, not just numeric)
    const looksLikeHeroId = inviteeId && inviteeId.length > 15 && !/^\d+$/.test(inviteeId);
    
    if (looksLikeHeroId || (heroId && inviteeId === heroId) || !actualHeroName || actualHeroRole === 'unknown') {
      // It might be a hero ID, try to get the user ID and hero info from the hero document
      console.log('[Parties] Fetching hero data for invite:', { inviteeId, heroId });
      
      // Determine which hero document to fetch
      const heroDocId = heroId || inviteeId;
      const heroDoc = await db.collection('heroes').doc(heroDocId).get();
      
      if (heroDoc.exists) {
        const heroData = heroDoc.data();
        
        // Get user ID from hero
        actualInviteeUserId = String(heroData.twitchUserId || heroData.userId || heroData.ownerId || inviteeId);
        
        // Use hero data to populate invite fields if not provided or incomplete
        if (!actualHeroName || actualHeroName === 'Unknown' || actualHeroName === inviteeName) {
          actualHeroName = heroData.name || heroData.heroName || heroData.twitchUsername || actualHeroName || 'Unknown';
        }
        if (!actualHeroRole || actualHeroRole === 'unknown') {
          actualHeroRole = heroData.role || heroData.heroRole || actualHeroRole || 'unknown';
        }
        if (!actualHeroLevel || actualHeroLevel === 1) {
          actualHeroLevel = heroData.level || heroData.heroLevel || actualHeroLevel || 1;
        }
        actualHeroId = heroDocId; // Ensure we use the correct hero document ID
        
        console.log('[Parties] Got hero data:', {
          heroId: actualHeroId,
          userId: actualInviteeUserId,
          heroName: actualHeroName,
          heroRole: actualHeroRole,
          heroLevel: actualHeroLevel
        });
      }
    }

    // Check if invitee is already in party (use normalized user ID)
    if (party.members.includes(actualInviteeUserId)) {
      return res.status(400).json({ error: 'Player is already in the party' });
    }

    // Check party size limit (default to dungeon limit)
    const queueType = party.queueType || 'dungeon';
    const maxSize = PARTY_LIMITS[queueType] || PARTY_LIMITS.dungeon;
    
    if (party.members.length >= maxSize) {
      return res.status(400).json({ error: `Party is full (max ${maxSize} members)` });
    }

    // Check if invitee is already in another party (use normalized user ID)
    const existingParty = await db.collection('parties')
      .where('members', 'array-contains', actualInviteeUserId)
      .where('status', 'in', [PARTY_STATUS.FORMING, PARTY_STATUS.QUEUED])
      .limit(1)
      .get();

    if (!existingParty.empty) {
      return res.status(400).json({ error: 'Player is already in another party' });
    }

    // Get inviter's name from party member data
    const inviterMember = party.memberData.find(m => m.userId === inviterId);
    const inviterName = inviterMember?.username || inviterId;

    // Create invite - use normalized user ID and hero data
    const inviteData = {
      partyId,
      inviterId,
      inviterName, // Add inviter's name
      inviteeId: actualInviteeUserId, // Use normalized user ID
      inviteeName: inviteeName || actualInviteeUserId,
      heroId: actualHeroId, // Store the actual hero document ID
      heroName: actualHeroName,
      heroRole: actualHeroRole,
      heroLevel: actualHeroLevel,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 5 * 60 * 1000) // 5 minutes
    };

    const inviteRef = await db.collection('partyInvites').add(inviteData);

    console.log(`[Parties] Invite sent: ${inviterId} -> ${actualInviteeUserId} (normalized from ${inviteeId}) for party ${partyId}`);

    res.json({
      success: true,
      inviteId: inviteRef.id,
      message: 'Invite sent successfully'
    });

  } catch (error) {
    console.error('[Parties] Error sending invite:', error);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

/**
 * Accept party invite
 * POST /api/parties/invites/:inviteId/accept
 */
router.post('/invites/:inviteId/accept', async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const inviteRef = db.collection('partyInvites').doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    const invite = inviteDoc.data();

    // Check if invite is for this user
    if (invite.inviteeId !== userId) {
      return res.status(403).json({ error: 'This invite is not for you' });
    }

    // Check if invite is still pending
    if (invite.status !== 'pending') {
      return res.status(400).json({ error: 'Invite has already been processed' });
    }

    // Check if invite expired
    if (invite.expiresAt?.toMillis() < Date.now()) {
      await inviteRef.update({ status: 'expired' });
      return res.status(400).json({ error: 'Invite has expired' });
    }

    // Get party
    const partyRef = db.collection('parties').doc(invite.partyId);
    const partyDoc = await partyRef.get();

    if (!partyDoc.exists) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyDoc.data();

    // Check if party is still forming/queued
    if (![PARTY_STATUS.FORMING, PARTY_STATUS.QUEUED].includes(party.status)) {
      return res.status(400).json({ error: 'Party is no longer accepting members' });
    }

    // Check party size
    const queueType = party.queueType || 'dungeon';
    const maxSize = PARTY_LIMITS[queueType] || PARTY_LIMITS.dungeon;
    
    if (party.members.length >= maxSize) {
      return res.status(400).json({ error: 'Party is full' });
    }

    // Add member to party
    await partyRef.update({
      members: admin.firestore.FieldValue.arrayUnion(invite.inviteeId),
      memberData: admin.firestore.FieldValue.arrayUnion({
        userId: invite.inviteeId,
        username: invite.inviteeName,
        heroId: invite.heroId,
        heroName: invite.heroName,
        heroRole: invite.heroRole,
        heroLevel: invite.heroLevel
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Mark invite as accepted
    await inviteRef.update({ 
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Parties] Invite accepted: ${invite.inviteeId} joined party ${invite.partyId}`);

    res.json({
      success: true,
      partyId: invite.partyId,
      message: 'Joined party successfully'
    });

  } catch (error) {
    console.error('[Parties] Error accepting invite:', error);
    res.status(500).json({ error: 'Failed to accept invite' });
  }
});

/**
 * Decline party invite
 * POST /api/parties/invites/:inviteId/decline
 */
router.post('/invites/:inviteId/decline', async (req, res) => {
  try {
    const { inviteId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const inviteRef = db.collection('partyInvites').doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    const invite = inviteDoc.data();

    if (invite.inviteeId !== userId) {
      return res.status(403).json({ error: 'This invite is not for you' });
    }

    await inviteRef.update({ 
      status: 'declined',
      declinedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Invite declined'
    });

  } catch (error) {
    console.error('[Parties] Error declining invite:', error);
    res.status(500).json({ error: 'Failed to decline invite' });
  }
});

/**
 * Leave party
 * POST /api/parties/:partyId/leave
 */
router.post('/:partyId/leave', async (req, res) => {
  try {
    const { partyId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const partyRef = db.collection('parties').doc(partyId);
    const partyDoc = await partyRef.get();

    if (!partyDoc.exists) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyDoc.data();

    if (!party.members.includes(userId)) {
      return res.status(400).json({ error: 'You are not in this party' });
    }

    // If leader leaves, transfer leadership or disband
    if (party.leaderId === userId) {
      const remainingMembers = party.members.filter(m => m !== userId);
      
      if (remainingMembers.length === 0) {
        // Disband party
        await partyRef.update({
          status: PARTY_STATUS.DISBANDED,
          disbandedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Transfer leadership to first remaining member
        const newLeader = remainingMembers[0];
        const newLeaderData = party.memberData.find(m => m.userId === newLeader);
        
        await partyRef.update({
          leaderId: newLeader,
          members: admin.firestore.FieldValue.arrayRemove(userId),
          memberData: admin.firestore.FieldValue.arrayRemove(
            party.memberData.find(m => m.userId === userId)
          ),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Parties] Leadership transferred: ${userId} -> ${newLeader} in party ${partyId}`);
      }
    } else {
      // Regular member leaving
      await partyRef.update({
        members: admin.firestore.FieldValue.arrayRemove(userId),
        memberData: admin.firestore.FieldValue.arrayRemove(
          party.memberData.find(m => m.userId === userId)
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    console.log(`[Parties] User ${userId} left party ${partyId}`);

    res.json({
      success: true,
      message: 'Left party successfully'
    });

  } catch (error) {
    console.error('[Parties] Error leaving party:', error);
    res.status(500).json({ error: 'Failed to leave party' });
  }
});

/**
 * Kick member from party (leader only)
 * POST /api/parties/:partyId/kick
 */
router.post('/:partyId/kick', async (req, res) => {
  try {
    const { partyId } = req.params;
    const { leaderId, memberId } = req.body;

    if (!leaderId || !memberId) {
      return res.status(400).json({ error: 'leaderId and memberId are required' });
    }

    const partyRef = db.collection('parties').doc(partyId);
    const partyDoc = await partyRef.get();

    if (!partyDoc.exists) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyDoc.data();

    if (party.leaderId !== leaderId) {
      return res.status(403).json({ error: 'Only the party leader can kick members' });
    }

    if (memberId === leaderId) {
      return res.status(400).json({ error: 'Cannot kick yourself' });
    }

    if (!party.members.includes(memberId)) {
      return res.status(400).json({ error: 'Member is not in the party' });
    }

    await partyRef.update({
      members: admin.firestore.FieldValue.arrayRemove(memberId),
      memberData: admin.firestore.FieldValue.arrayRemove(
        party.memberData.find(m => m.userId === memberId)
      ),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Parties] Member ${memberId} kicked from party ${partyId} by leader ${leaderId}`);

    res.json({
      success: true,
      message: 'Member kicked successfully'
    });

  } catch (error) {
    console.error('[Parties] Error kicking member:', error);
    res.status(500).json({ error: 'Failed to kick member' });
  }
});

/**
 * Transfer leadership
 * POST /api/parties/:partyId/transfer
 */
router.post('/:partyId/transfer', async (req, res) => {
  try {
    const { partyId } = req.params;
    const { currentLeaderId, newLeaderId } = req.body;

    if (!currentLeaderId || !newLeaderId) {
      return res.status(400).json({ error: 'currentLeaderId and newLeaderId are required' });
    }

    const partyRef = db.collection('parties').doc(partyId);
    const partyDoc = await partyRef.get();

    if (!partyDoc.exists) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyDoc.data();

    if (party.leaderId !== currentLeaderId) {
      return res.status(403).json({ error: 'Only the current leader can transfer leadership' });
    }

    if (!party.members.includes(newLeaderId)) {
      return res.status(400).json({ error: 'New leader must be a party member' });
    }

    await partyRef.update({
      leaderId: newLeaderId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Parties] Leadership transferred: ${currentLeaderId} -> ${newLeaderId} in party ${partyId}`);

    res.json({
      success: true,
      message: 'Leadership transferred successfully'
    });

  } catch (error) {
    console.error('[Parties] Error transferring leadership:', error);
    res.status(500).json({ error: 'Failed to transfer leadership' });
  }
});

/**
 * Cancel party queue (remove all members from queue)
 * POST /api/parties/:partyId/cancel-queue
 * Body: { userId: string } (must be party leader)
 * NOTE: This must be defined BEFORE /:partyId/queue to avoid route conflicts
 */
router.post('/:partyId/cancel-queue', async (req, res) => {
  try {
    const { partyId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // Get party
    const partyRef = db.collection('parties').doc(partyId);
    const partyDoc = await partyRef.get();

    if (!partyDoc.exists) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyDoc.data();

    // Verify user is the party leader
    if (party.leaderId !== userId) {
      return res.status(403).json({ error: 'Only the party leader can cancel the queue' });
    }

    // Check if party is actually queued
    if (party.status !== PARTY_STATUS.QUEUED) {
      return res.status(400).json({ error: 'Party is not in queue' });
    }

    const removedCount = { dungeon: 0, raid: 0 };

    // Remove all party members from queues
    if (party.queueType === 'dungeon') {
      // Remove from dungeon queue
      const queueSnapshot = await db.collection('dungeonQueue')
        .where('partyId', '==', partyId)
        .get();

      const deletePromises = queueSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
      removedCount.dungeon = queueSnapshot.docs.length;

      console.log(`[Parties] Removed ${removedCount.dungeon} members from dungeon queue for party ${partyId}`);
    } else if (party.queueType === 'raid' && party.raidId) {
      // Remove from raid queue
      const raidQueueRef = db.collection('raidQueues').doc(party.raidId);
      const raidQueueDoc = await raidQueueRef.get();

      if (raidQueueDoc.exists) {
        const raidQueue = raidQueueDoc.data();
        const updatedParticipants = (raidQueue.participants || []).filter(
          (p) => p.partyId !== partyId
        );

        await raidQueueRef.update({
          participants: updatedParticipants,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        removedCount.raid = (raidQueue.participants || []).length - updatedParticipants.length;
        console.log(`[Parties] Removed ${removedCount.raid} members from raid queue for party ${partyId}`);
      }
    }

    // Update party status back to forming
    await partyRef.update({
      status: PARTY_STATUS.FORMING,
      queueType: null,
      raidId: null,
      dungeonType: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Parties] Party ${partyId} queue cancelled by leader ${userId}`);

    res.json({
      success: true,
      message: 'Queue cancelled successfully',
      removed: removedCount.dungeon + removedCount.raid
    });

  } catch (error) {
    console.error('[Parties] Error cancelling queue:', error);
    res.status(500).json({ error: 'Failed to cancel queue' });
  }
});

/**
 * Queue entire party for dungeon or raid
 * POST /api/parties/:partyId/queue
 */
router.post('/:partyId/queue', async (req, res) => {
  try {
    const { partyId } = req.params;
    const { queueType, raidId, dungeonType } = req.body;

    if (!queueType || !['dungeon', 'raid'].includes(queueType)) {
      return res.status(400).json({ error: 'queueType must be "dungeon" or "raid"' });
    }

    if (queueType === 'raid' && !raidId) {
      return res.status(400).json({ error: 'raidId required for raid queue' });
    }

    // Get party
    const partyRef = db.collection('parties').doc(partyId);
    const partyDoc = await partyRef.get();

    if (!partyDoc.exists) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const party = partyDoc.data();

    // Check party status
    if (party.status !== PARTY_STATUS.FORMING) {
      return res.status(400).json({ error: 'Party must be in forming status to queue' });
    }

    // Validate party size
    const maxSize = PARTY_LIMITS[queueType] || PARTY_LIMITS.dungeon;
    if (party.members.length > maxSize) {
      return res.status(400).json({ error: `Party too large for ${queueType} (max ${maxSize} members)` });
    }

    // Get all party member hero data
    const heroPromises = party.memberData.map(member => 
      db.collection('heroes').doc(member.heroId).get()
    );
    const heroDocs = await Promise.all(heroPromises);

    const queueResults = [];
    const errors = [];

    // Queue each party member
    for (let i = 0; i < party.memberData.length; i++) {
      const member = party.memberData[i];
      const heroDoc = heroDocs[i];

      if (!heroDoc.exists) {
        errors.push({ userId: member.userId, error: 'Hero not found' });
        continue;
      }

      const hero = heroDoc.data();
      const heroLevel = hero.level || 1;
      const heroItemScore = calculateItemScore(hero.equipment || {});

      // Normalize role
      const normalizedRole = normalizeRole(member.heroRole || hero.role);

      try {
        if (queueType === 'dungeon') {
          // Queue for dungeon
          const existingQueue = await db.collection('dungeonQueue')
            .where('userId', '==', member.userId)
            .limit(1)
            .get();

          if (!existingQueue.empty) {
            errors.push({ userId: member.userId, error: 'Already in dungeon queue' });
            continue;
          }

          const queueEntry = {
            userId: member.userId,
            heroId: member.heroId,
            role: normalizedRole,
            originalRole: member.heroRole || hero.role,
            itemScore: heroItemScore,
            dungeonType: dungeonType || 'normal',
            partyId, // Link to party
            queuedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000))
          };

          await db.collection('dungeonQueue').add(queueEntry);
          queueResults.push({ userId: member.userId, success: true, type: 'dungeon' });

        } else if (queueType === 'raid') {
          // Queue for raid
          const { getRaidById } = await import('../data/raids.js');
          const raidData = getRaidById(raidId);

          if (!raidData) {
            errors.push({ userId: member.userId, error: 'Raid not found' });
            continue;
          }

          // Check requirements
          if (heroLevel < raidData.minLevel || heroItemScore < raidData.minItemScore) {
            errors.push({ 
              userId: member.userId, 
              error: `Requirements not met. Need Level ${raidData.minLevel} and ${raidData.minItemScore} item score` 
            });
            continue;
          }

          // Get or create raid queue
          const raidQueueRef = db.collection('raidQueues').doc(raidId);
          const raidQueueDoc = await raidQueueRef.get();

          let raidQueue = raidQueueDoc.exists ? raidQueueDoc.data() : {
            raidId,
            participants: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };

          // Check if already in queue
          if (raidQueue.participants.some(p => p.userId === member.userId)) {
            errors.push({ userId: member.userId, error: 'Already in raid queue' });
            continue;
          }

          // Add to raid queue
          const participant = {
            userId: member.userId,
            heroId: member.heroId,
            heroName: member.heroName || hero.name || 'Unknown',
            heroLevel,
            heroRole: normalizedRole,
            itemScore: heroItemScore,
            role: normalizedRole,
            partyId, // Link to party
            joinedAt: Date.now()
          };

          raidQueue.participants.push(participant);

          await raidQueueRef.set({
            ...raidQueue,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          queueResults.push({ userId: member.userId, success: true, type: 'raid', raidId });
        }
      } catch (error) {
        console.error(`[Parties] Error queueing member ${member.userId}:`, error);
        errors.push({ userId: member.userId, error: error.message || 'Failed to queue' });
      }
    }

    // Update party status to queued
    if (queueResults.length > 0) {
      await partyRef.update({
        status: PARTY_STATUS.QUEUED,
        queueType,
        raidId: queueType === 'raid' ? raidId : null,
        dungeonType: queueType === 'dungeon' ? (dungeonType || 'normal') : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Note: Matchmaking will be triggered automatically by the existing queue system
    // when members are added to dungeonQueue or raidQueues collections
    // The matchmaking functions check these collections periodically

    res.json({
      success: queueResults.length > 0,
      queued: queueResults.length,
      total: party.members.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length > 0 
        ? `Queued ${queueResults.length} of ${party.members.length} members. Some members failed to queue.`
        : `Successfully queued all ${queueResults.length} party members for ${queueType}`
    });

  } catch (error) {
    console.error('[Parties] Error queueing party:', error);
    res.status(500).json({ error: 'Failed to queue party' });
  }
});

// Helper function to normalize role
function normalizeRole(heroRole) {
  if (!heroRole) return 'dps';
  
  const roleLower = heroRole.toLowerCase();
  
  const tankRoles = ['guardian', 'paladin', 'warden', 'bloodknight', 'vanguard', 'brewmaster'];
  if (tankRoles.includes(roleLower) || roleLower === 'tank') {
    return 'tank';
  }
  
  const healerRoles = ['cleric', 'atoner', 'druid', 'lightbringer', 'shaman', 'mistweaver', 'chronomancer', 'bard'];
  if (healerRoles.includes(roleLower) || roleLower === 'healer') {
    return 'healer';
  }
  
  return 'dps';
}

// Helper function to calculate item score
function calculateItemScore(equipment) {
  if (!equipment) return 0;
  
  let score = 0;
  Object.values(equipment).forEach(item => {
    if (item && item.baseStats) {
      const stats = item.baseStats;
      score += (stats.attack || 0) + (stats.defense || 0) + (stats.hp || 0) / 10;
    }
  });
  
  return Math.round(score);
}

/**
 * Get pending invites for a user
 * GET /api/parties/invites/:userId
 */
router.get('/invites/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Query without orderBy to avoid requiring a composite index
    // We'll sort in memory instead
    const invitesSnapshot = await db.collection('partyInvites')
      .where('inviteeId', '==', userId)
      .where('status', '==', 'pending')
      .get();

    const invites = invitesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toMillis() || Date.now(),
        expiresAt: data.expiresAt?.toMillis() || null
      };
    });

    // Sort by createdAt descending in memory
    invites.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    res.json({
      success: true,
      invites
    });

  } catch (error) {
    console.error('[Parties] Error fetching invites:', error);
    res.status(500).json({ error: 'Failed to fetch invites' });
  }
});

export default router;
