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

    // Check if this is a test player (userId starts with 'test-')
    const isTestPlayer = actualInviteeUserId.startsWith('test-');
    
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

    // Auto-accept for test players (userId starts with 'test-')
    if (isTestPlayer) {
      try {
        // Get party to check size
        const partyRef = db.collection('parties').doc(partyId);
        const partyDoc = await partyRef.get();
        
        if (partyDoc.exists) {
          const party = partyDoc.data();
          const queueType = party.queueType || 'dungeon';
          const maxSize = PARTY_LIMITS[queueType] || PARTY_LIMITS.dungeon;
          
          // Only auto-accept if party isn't full
          if (party.members.length < maxSize) {
            // Add member to party
            await partyRef.update({
              members: admin.firestore.FieldValue.arrayUnion(actualInviteeUserId),
              memberData: admin.firestore.FieldValue.arrayUnion({
                userId: actualInviteeUserId,
                username: inviteeName || actualInviteeUserId,
                heroId: actualHeroId,
                heroName: actualHeroName,
                heroRole: actualHeroRole,
                heroLevel: actualHeroLevel
              }),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Mark invite as accepted
            await inviteRef.update({ 
              status: 'accepted',
              acceptedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[Parties] Test player ${actualInviteeUserId} auto-accepted invite to party ${partyId}`);
            
            return res.json({
              success: true,
              inviteId: inviteRef.id,
              message: 'Test player auto-accepted invite and joined party',
              autoAccepted: true
            });
          }
        }
      } catch (error) {
        console.error(`[Parties] Error auto-accepting invite for test player:`, error);
        // Continue with normal invite flow if auto-accept fails
      }
    }

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
      dungeonId: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Parties] Party ${partyId} queue cancelled, status reset to forming`);

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
    const { queueType, raidId, dungeonType, dungeonId, fillParty } = req.body;

    console.log(`[Parties] 🔵 Queue request received for party ${partyId}:`, {
      queueType,
      raidId,
      dungeonType,
      dungeonId,
      fillParty
    });

    if (!queueType || !['dungeon', 'raid'].includes(queueType)) {
      console.log(`[Parties] ❌ Invalid queueType: ${queueType}`);
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

    let party = partyDoc.data();
    
    // Validate party size against requirements
    if (queueType === 'raid' && raidId) {
      const { getRaidById } = await import('../data/raids.js');
      const raidData = getRaidById(raidId);
      
      if (raidData) {
        // Only validate if fillParty is false (immediate start)
        // If fillParty is true, allow smaller parties to queue and wait for matchmaking
        if (fillParty === false && party.memberData.length < raidData.minPlayers) {
          return res.status(400).json({ 
            error: `Party too small for ${raidData.name}. Need at least ${raidData.minPlayers} players to start immediately, but party has ${party.memberData.length}. Enable "Fill Party" to wait for matchmaking, or invite more members.`
          });
        }
        if (party.memberData.length > raidData.maxPlayers) {
          return res.status(400).json({ 
            error: `Party too large for ${raidData.name}. Maximum ${raidData.maxPlayers} players, but party has ${party.memberData.length}.`
          });
        }
      }
    }
    
    // Validate dungeon party size and check if we should start immediately (if party is full)
    if (queueType === 'dungeon' && dungeonId) {
      const { getDungeonById } = await import('../data/dungeons.js');
      const dungeonData = getDungeonById(dungeonId);
      
      if (dungeonData) {
        if (party.memberData.length > dungeonData.maxPlayers) {
          return res.status(400).json({ 
            error: `Party too large for ${dungeonData.name}. Maximum ${dungeonData.maxPlayers} players, but party has ${party.memberData.length}.`
          });
        }
        
        // If party is full (equals maxPlayers), we'll start immediately below regardless of fillParty
        if (party.memberData.length === dungeonData.maxPlayers) {
          console.log(`[Parties] 🎯 Party is full (${party.memberData.length}/${dungeonData.maxPlayers}), will start immediately`);
        }
      }
    }

    // Check party status - allow queuing if party is forming or just returned from instance
    if (party.status !== PARTY_STATUS.FORMING && party.status !== PARTY_STATUS.IN_INSTANCE) {
      return res.status(400).json({ error: 'Party must be in forming or in_instance status to queue' });
    }
    
    // If party is in_instance, reset to forming before queueing
    // IMPORTANT: Refresh party data after reset to ensure we have latest state
    if (party.status === PARTY_STATUS.IN_INSTANCE) {
      await partyRef.update({
        status: PARTY_STATUS.FORMING,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      // Refresh party data from Firestore to ensure we have latest state
      // IMPORTANT: Preserve memberData from original party object since it might not be in Firestore
      const originalMemberData = party.memberData;
      const refreshedPartyDoc = await partyRef.get();
      if (refreshedPartyDoc.exists) {
        const refreshedData = refreshedPartyDoc.data();
        party = { 
          id: refreshedPartyDoc.id, 
          ...refreshedData,
          // Ensure memberData is preserved (it might not be stored in Firestore)
          memberData: refreshedData.memberData || originalMemberData || []
        };
      } else {
        party.status = PARTY_STATUS.FORMING; // Fallback: update local party object
      }
      console.log(`[Parties] Reset party ${partyId} from in_instance to forming before queueing. memberData length: ${party.memberData?.length || 0}`);
    }

    // Validate party size
    const maxSize = PARTY_LIMITS[queueType] || PARTY_LIMITS.dungeon;
    if (party.members.length > maxSize) {
      return res.status(400).json({ error: `Party too large for ${queueType} (max ${maxSize} members)` });
    }
    
    console.log(`[Parties] Party status after reset: ${party.status}, memberData length: ${party.memberData?.length || 0}`);

    // Get all party member hero data
    if (!party.memberData || party.memberData.length === 0) {
      console.log(`[Parties] ❌ No memberData found in party`);
      return res.status(400).json({ error: 'Party has no members' });
    }
    
    console.log(`[Parties] 🔍 Fetching hero data for ${party.memberData.length} members...`);
    const heroPromises = party.memberData.map(member => 
      db.collection('heroes').doc(member.heroId).get()
    );
    const heroDocs = await Promise.all(heroPromises);
    console.log(`[Parties] ✅ Fetched ${heroDocs.length} hero documents`);

    const queueResults = [];
    const errors = [];

    // Check if we should start immediately (fillParty = false and party meets requirements)
    if (queueType === 'raid' && fillParty === false && raidId) {
      const { getRaidById } = await import('../data/raids.js');
      const raidData = getRaidById(raidId);
      
      console.log(`[Parties] Checking immediate start for raid: fillParty=${fillParty}, partySize=${party.memberData?.length || 0}, minPlayers=${raidData?.minPlayers || 'N/A'}, maxPlayers=${raidData?.maxPlayers || 'N/A'}`);
      
      if (raidData && party.memberData && party.memberData.length >= raidData.minPlayers && party.memberData.length <= raidData.maxPlayers) {
        // Party meets requirements - start immediately!
        console.log(`[Parties] ✅ Party meets requirements, starting raid immediately`);
        try {
          // Prepare participants for raid instance
          const raidParticipants = [];
          for (let i = 0; i < party.memberData.length; i++) {
            const member = party.memberData[i];
            const heroDoc = heroDocs[i];
            
            if (!heroDoc.exists) {
              errors.push({ userId: member.userId, error: 'Hero not found' });
              continue;
            }
            
            const hero = heroDoc.data();
            const heroItemScore = calculateItemScore(hero.equipment || {});
            const normalizedRole = normalizeRole(member.heroRole || hero.role);
            
            // Check requirements
            if (hero.level < raidData.minLevel || heroItemScore < raidData.minItemScore) {
              errors.push({ 
                userId: member.userId, 
                error: `Requirements not met. Need Level ${raidData.minLevel} and ${raidData.minItemScore} item score` 
              });
              continue;
            }
            
            raidParticipants.push({
              userId: member.userId,
              username: member.username || 'Unknown',
              heroId: member.heroId,
              heroName: member.heroName || hero.name || 'Unknown',
              heroLevel: hero.level || 1,
              heroRole: normalizedRole,
              itemScore: heroItemScore,
              isAlive: true
            });
          }
          
          if (raidParticipants.length === party.memberData.length) {
            // Generate wave enemies for each wave (except final boss wave)
            const totalWaves = raidData.waves || 3;
            const waveEnemies = [];
            
            for (let wave = 0; wave < totalWaves - 1; wave++) {
              // Generate enemies for this wave
              const enemyPool = [
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
            
            // All members valid - create raid instance immediately
            const raidInstance = {
              raidId: raidData.id,
              organizerId: party.leaderId || party.members[0],
              participants: raidParticipants,
              participantIds: raidParticipants.map(p => p.userId),
              status: 'active', // Use 'active' to match frontend listener query
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
              partyId // Link to party
            };
            
            const instanceRef = await db.collection('raidInstances').add(raidInstance);
            
            // Update all heroes to have activeInstance pointing to this raid
            const participantHeroIds = raidParticipants.map(p => p.heroId);
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
                console.error(`[Parties] Failed to update hero ${heroId} with active instance:`, error);
              }
            });
            
            await Promise.all(updatePromises);
            console.log(`[Parties] ✅ Updated all ${raidParticipants.length} heroes with active raid instance`);
            
            // Update party status
            await partyRef.update({
              status: PARTY_STATUS.IN_INSTANCE,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`[Parties] ✅ Raid instance created: ${instanceRef.id}`);
            return res.json({
              success: true,
              queued: 0,
              total: party.memberData.length,
              message: `Raid started immediately with ${party.memberData.length} party member(s)`,
              instanceCreated: true,
              instanceId: instanceRef.id
            });
          }
        } catch (error) {
          console.error(`[Parties] ❌ Failed to start raid immediately for party ${partyId}:`, error);
          console.error(`[Parties] Error stack:`, error.stack);
          // Fall through to queue normally if immediate start fails
        }
      } else {
        console.log(`[Parties] ⚠️ Party does not meet requirements for immediate start: size=${party.memberData?.length || 0}, min=${raidData?.minPlayers || 'N/A'}, max=${raidData?.maxPlayers || 'N/A'}`);
      }
    }
    
    console.log(`[Parties] 📝 Proceeding to queue members (fillParty=${fillParty}, queueType=${queueType})...`);
    
    // Start dungeon immediately if:
    // 1. fillParty is false (user wants to start immediately), OR
    // 2. Party size equals maxPlayers (full party, should start immediately regardless of fillParty)
    if (queueType === 'dungeon') {
      const { getDungeonById } = await import('../data/dungeons.js');
      const { createDungeonInstanceForGroup } = await import('./dungeon.js');
      
      const targetDungeonId = dungeonId || 'goblin_cave';
      const dungeonData = getDungeonById(targetDungeonId);
      
      // Check if we should start immediately: either fillParty is false OR party is full
      const shouldStartImmediately = fillParty === false || (dungeonData && party.memberData.length === dungeonData.maxPlayers);
      
      // Start immediately if conditions are met and party size is within max
      if (shouldStartImmediately && dungeonData && party.memberData.length > 0 && party.memberData.length <= dungeonData.maxPlayers) {
        const reason = party.memberData.length === dungeonData.maxPlayers 
          ? `party is full (${party.memberData.length}/${dungeonData.maxPlayers} players)`
          : `fillParty=false, no composition/size validation`;
        console.log(`[Parties] ✅ Starting dungeon immediately with ${party.memberData.length} member(s) (${reason})`);
        // Start immediately regardless of party composition or min size
        try {
          // Prepare queue entries format for createDungeonInstanceForGroup
          const queueMembers = [];
          for (let i = 0; i < party.memberData.length; i++) {
            const member = party.memberData[i];
            const heroDoc = heroDocs[i];
            
            if (!heroDoc.exists) {
              errors.push({ userId: member.userId, error: 'Hero not found' });
              continue;
            }
            
            const hero = heroDoc.data();
            const heroItemScore = calculateItemScore(hero.equipment || {});
            const normalizedRole = normalizeRole(member.heroRole || hero.role);
            
            queueMembers.push({
              id: `temp-${member.userId}`, // Temporary ID for queue entry format
              userId: member.userId,
              heroId: member.heroId,
              role: normalizedRole,
              originalRole: member.heroRole || hero.role,
              itemScore: heroItemScore,
              dungeonType: dungeonType || 'normal',
              dungeonId: targetDungeonId,
              partyId
            });
          }
          
          if (queueMembers.length === party.memberData.length) {
            // All members valid - use party format with members array
            // This allows variable party sizes (not restricted to exactly 5)
            const group = {
              members: queueMembers,
              partyId: partyId,
              dungeonId: targetDungeonId,
              dungeonType: dungeonType || 'normal'
            };
            
            // Create dungeon instance immediately with party format
            await createDungeonInstanceForGroup(group, dungeonData);
            
            // Update party status
            await partyRef.update({
              status: PARTY_STATUS.IN_INSTANCE,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            return res.json({
              success: true,
              queued: 0,
              total: party.memberData.length,
              message: `Dungeon started immediately with ${party.memberData.length} party member(s)`,
              instanceCreated: true
            });
          }
        } catch (error) {
          console.error(`[Parties] Failed to start dungeon immediately for party ${partyId}:`, error);
          // Fall through to queue normally if immediate start fails
        }
      }
    }

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
      
      // Debug logging for item score calculation
      console.log(`[Parties] Member ${member.userId} (${member.heroName || hero.name}): level=${heroLevel}, itemScore=${heroItemScore}, equipment keys:`, Object.keys(hero.equipment || {}));

      // Normalize role
      const normalizedRole = normalizeRole(member.heroRole || hero.role);

      try {
        if (queueType === 'dungeon') {
          // Queue for dungeon
          const existingQueue = await db.collection('dungeonQueue')
            .where('userId', '==', member.userId)
            .limit(1)
            .get();

          // Check if already in queue (but allow if it's from the same party - they might be re-queueing)
          if (!existingQueue.empty) {
            const existingEntry = existingQueue.docs[0].data();
            if (existingEntry.partyId !== partyId) {
              errors.push({ userId: member.userId, error: 'Already in dungeon queue with a different party' });
              continue;
            }
            // If same party, remove old entry first (re-queueing scenario)
            await existingQueue.docs[0].ref.delete();
            console.log(`[Parties] Removed old dungeon queue entry for member ${member.userId} (re-queueing)`);
          }

          // Get available dungeons to determine which one to queue for
          const { getDungeonById } = await import('../data/dungeons.js');
          
          // Use provided dungeonId or default to goblin_cave
          const targetDungeonId = dungeonId || 'goblin_cave';
          
          // Validate dungeon exists
          const dungeonData = getDungeonById(targetDungeonId);
          if (!dungeonData) {
            errors.push({ userId: member.userId, error: `Dungeon ${targetDungeonId} not found` });
            continue;
          }
          
          const queueEntry = {
            userId: member.userId,
            heroId: member.heroId,
            role: normalizedRole,
            originalRole: member.heroRole || hero.role,
            itemScore: heroItemScore,
            dungeonType: dungeonType || 'normal',
            dungeonId: targetDungeonId, // Specify which dungeon to queue for
            partyId, // Link to party
            fillParty: fillParty !== false, // Default to true (wait for matchmaking), false = start immediately with party only
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
              error: `Requirements not met. Need Level ${raidData.minLevel}+ (has ${heroLevel}) and ${raidData.minItemScore}+ Item Score (has ${heroItemScore})` 
            });
            console.log(`[Parties] Member ${member.userId} failed requirements: level ${heroLevel}/${raidData.minLevel}, itemScore ${heroItemScore}/${raidData.minItemScore}`);
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
            fillParty: fillParty !== false, // Store fillParty flag (default to true)
            joinedAt: Date.now()
          };

          // Check if already in queue (but allow if it's from the same party - they might be re-queueing)
          const existingInQueue = raidQueue.participants.find(p => p.userId === member.userId);
          if (existingInQueue && existingInQueue.partyId !== partyId) {
            errors.push({ userId: member.userId, error: 'Already in raid queue with a different party' });
            console.log(`[Parties] Member ${member.userId} already in raid queue with different party`);
            continue;
          }
          // If same party, remove old entry first (re-queueing scenario)
          if (existingInQueue && existingInQueue.partyId === partyId) {
            raidQueue.participants = raidQueue.participants.filter(p => p.userId !== member.userId);
            console.log(`[Parties] Removed old queue entry for member ${member.userId} (re-queueing)`);
          }

          raidQueue.participants.push(participant);

          await raidQueueRef.set({
            ...raidQueue,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          console.log(`[Parties] Successfully queued member ${member.userId} for raid ${raidId}`);
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

    // Trigger matchmaking immediately after queueing
    if (queueResults.length > 0) {
      if (queueType === 'dungeon') {
        try {
          const { tryMatchmaking } = await import('./dungeon.js');
          await tryMatchmaking();
          console.log(`[Parties] ✅ Triggered dungeon matchmaking after party queue`);
        } catch (error) {
          console.error(`[Parties] Failed to trigger dungeon matchmaking:`, error);
          // Don't fail the request if matchmaking trigger fails
        }
      } else if (queueType === 'raid' && raidId) {
        try {
          const { getRaidById } = await import('../data/raids.js');
          const { tryRaidMatchmaking } = await import('./raids.js');
          const raidData = getRaidById(raidId);
          if (raidData) {
            await tryRaidMatchmaking(raidId, raidData);
            console.log(`[Parties] ✅ Triggered raid matchmaking after party queue`);
          }
        } catch (error) {
          console.error(`[Parties] Failed to trigger raid matchmaking:`, error);
        }
      }
    }

    console.log(`[Parties] Queue result: ${queueResults.length} queued, ${errors.length} errors out of ${party.memberData.length} members`);
    if (errors.length > 0) {
      console.log(`[Parties] Queue errors:`, errors);
    }

    res.json({
      success: queueResults.length > 0,
      queued: queueResults.length,
      total: party.memberData.length,
      errors: errors.length > 0 ? errors : undefined,
      message: errors.length > 0 
        ? `Queued ${queueResults.length} of ${party.memberData.length} members. Some members failed to queue.`
        : `Successfully queued all ${queueResults.length} party members for ${queueType}`
    });

  } catch (error) {
    console.error('[Parties] ❌ Error queueing party:', error);
    console.error('[Parties] Error stack:', error.stack);
    console.error('[Parties] Error message:', error.message);
    res.status(500).json({ error: 'Failed to queue party', details: error.message });
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
    if (item) {
      // If item has itemScore directly, use it
      if (item.itemScore) {
        score += item.itemScore;
      }
      // Otherwise, calculate from stats
      else if (item.baseStats) {
        const stats = item.baseStats;
        score += (stats.attack || 0) + (stats.defense || 0) + (stats.hp || 0) / 10;
      }
      // Or if stats are directly on the item
      else {
        score += (item.attack || 0) + (item.defense || 0) + (item.hp || 0) / 10;
      }
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
