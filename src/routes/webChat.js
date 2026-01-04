import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Rate limiting: 1 message per second per user
const userMessageTimestamps = new Map();
const RATE_LIMIT_MS = 1000; // 1 second

function checkRateLimit(userId) {
  const now = Date.now();
  const lastMessage = userMessageTimestamps.get(userId);
  
  if (lastMessage && (now - lastMessage) < RATE_LIMIT_MS) {
    return false; // Rate limited
  }
  
  userMessageTimestamps.set(userId, now);
  return true; // Allowed
}

/**
 * Send a chat message
 * POST /api/web-chat/send
 * Body: {
 *   userId: string,
 *   heroId: string,
 *   channel: 'party' | 'world' | 'whisper' | 'guild',
 *   message: string,
 *   partyId?: string (required for party chat),
 *   guildId?: string (required for guild chat),
 *   recipientId?: string (required for whisper)
 * }
 */
router.post('/send', async (req, res) => {
  try {
    const { userId, heroId, channel, message, partyId, guildId, recipientId } = req.body;

    if (!userId || !heroId || !channel || !message) {
      return res.status(400).json({ error: 'Missing required fields: userId, heroId, channel, message' });
    }

    // Normalize IDs to strings
    const normalizedUserId = String(userId);
    const normalizedRecipientId = recipientId ? String(recipientId) : null;

    if (channel !== 'party' && channel !== 'world' && channel !== 'whisper' && channel !== 'guild') {
      return res.status(400).json({ error: 'channel must be "party", "world", "whisper", or "guild"' });
    }

    if (channel === 'party' && !partyId) {
      return res.status(400).json({ error: 'partyId required for party chat' });
    }

    if (channel === 'guild' && !guildId) {
      return res.status(400).json({ error: 'guildId required for guild chat' });
    }

    if (channel === 'whisper' && !normalizedRecipientId) {
      return res.status(400).json({ error: 'recipientId required for whisper' });
    }

    if (channel === 'whisper' && normalizedUserId === normalizedRecipientId) {
      return res.status(400).json({ error: 'Cannot whisper yourself' });
    }

    // Check if user is banned
    const banSnapshot = await db.collection('chatBans')
      .where('bannedUserId', '==', userId)
      .get();
    
    const now = Date.now();
    const isBanned = banSnapshot.docs.some(doc => {
      const banData = doc.data();
      if (banData.permanent) return true;
      const bannedUntil = banData.bannedUntil?.toMillis() || 0;
      return bannedUntil > now;
    });

    if (isBanned) {
      return res.status(403).json({ error: 'You are banned from chat' });
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait before sending another message.' });
    }

    // Validate message length
    if (message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (message.length > 500) {
      return res.status(400).json({ error: 'Message too long (max 500 characters)' });
    }

    // Get hero data
    const heroDoc = await db.collection('heroes').doc(heroId).get();
    if (!heroDoc.exists) {
      console.error('[WebChat] Hero document not found:', { heroId });
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = heroDoc.data();
    const username = hero.twitchUsername || hero.username || hero.name || 'Unknown';
    const heroName = hero.name || username;
    const heroRole = hero.role || 'berserker';
    
    // Get hero level - ensure it's a number
    // Check multiple possible field names and ensure we get the actual level
    let heroLevel = 1;
    
    // First check the standard 'level' field
    if (hero.level !== undefined && hero.level !== null) {
      heroLevel = typeof hero.level === 'number' ? hero.level : parseInt(hero.level, 10);
      if (isNaN(heroLevel)) {
        console.warn('[WebChat] Hero level is not a valid number, defaulting to 1:', { heroId, level: hero.level });
        heroLevel = 1;
      }
    } else {
      // Level field doesn't exist or is null/undefined
      console.warn('[WebChat] Hero level field is missing or null:', {
        heroId,
        heroName,
        hasLevelField: 'level' in hero,
        levelValue: hero.level,
        allHeroFields: Object.keys(hero).slice(0, 20) // First 20 fields for debugging
      });
    }
    
    const founderPackTier = hero.founderPackTier || null; // Include founder pack tier for badge display
    
    // Debug logging for hero level - always log to help diagnose
    console.log('[WebChat] Hero data for message:', {
      heroId,
      heroName,
      heroLevel,
      heroLevelRaw: hero.level,
      heroLevelType: typeof hero.level,
      hasLevelField: 'level' in hero,
      levelIsUndefined: hero.level === undefined,
      levelIsNull: hero.level === null
    });

    // For party chat, verify user is in the party
    if (channel === 'party') {
      const partyDoc = await db.collection('parties').doc(partyId).get();
      if (!partyDoc.exists) {
        return res.status(404).json({ error: 'Party not found' });
      }

      const party = partyDoc.data();
      
      // Normalize IDs to strings for comparison
      const userIdStr = String(userId);
      const heroTwitchUserId = String(hero.twitchUserId || hero.twitchId || '');
      
      // Check both members array and memberData array for userId
      // Convert all to strings for comparison
      const partyMembers = (party.members || []).map(m => String(m));
      const memberDataUserIds = (party.memberData || []).map(m => String(m.userId || ''));
      
      const isMember = partyMembers.includes(userIdStr) || 
                      partyMembers.includes(heroTwitchUserId) ||
                      memberDataUserIds.includes(userIdStr) ||
                      memberDataUserIds.includes(heroTwitchUserId);
      
      if (!isMember) {
        console.error('[WebChat] Party membership check failed:', {
          userId: userIdStr,
          heroTwitchUserId,
          partyMembers,
          memberDataUserIds,
          partyId
        });
        return res.status(403).json({ 
          error: 'You are not a member of this party',
          debug: {
            userId: userIdStr,
            heroTwitchUserId,
            partyMembers,
            memberDataUserIds
          }
        });
      }
      
      console.log('[WebChat] Party membership verified:', {
        userId: userIdStr,
        partyId,
        isMember: true
      });
    }

    // For guild chat, verify the HERO is a guild member (guilds are per-hero, not per-user)
    if (channel === 'guild') {
      const guildDoc = await db.collection('guilds').doc(guildId).get();
      if (!guildDoc.exists) {
        return res.status(404).json({ error: 'Guild not found' });
      }

      const guild = guildDoc.data();
      const memberIds = guild.memberIds || [];
      
      // Normalize IDs to strings for comparison
      const heroIdStr = String(heroId);
      
      // Check if this specific hero is a member (guilds store hero IDs in memberIds)
      const isMember = memberIds.some(memberId => {
        const normalizedMemberId = String(memberId);
        return normalizedMemberId === heroIdStr;
      });
      
      if (!isMember) {
        return res.status(403).json({ 
          error: 'This hero is not a member of this guild'
        });
      }
      
      console.log('[WebChat] Guild membership verified for hero:', {
        heroId: heroIdStr,
        heroName: hero.name,
        guildId,
        isMember: true
      });
    }

    // For whispers, get recipient user ID and hero data
    let recipientHeroName = null;
    let recipientHeroId = null;
    // For whispers, recipientId is now a hero ID (hero-to-hero messaging)
    if (channel === 'whisper') {
      if (!normalizedRecipientId) {
        return res.status(400).json({ error: 'Recipient ID is required for whispers' });
      }
      
      // Fetch the recipient hero document
      const recipientHeroDoc = await db.collection('heroes').doc(normalizedRecipientId).get();
      
      if (!recipientHeroDoc.exists) {
        return res.status(404).json({ error: 'Recipient hero not found' });
      }
      
      const recipientHero = recipientHeroDoc.data();
      recipientHeroId = recipientHeroDoc.id;
      recipientHeroName = recipientHero.name || recipientHero.twitchUsername || 'Unknown';
      
      console.log('[WebChat] Whisper to hero:', {
        recipientHeroId: recipientHeroId,
        recipientHeroName: recipientHeroName
      });
    }

    // Create message document
    const messageData = {
      channel,
      userId: normalizedUserId, // Use normalized userId (Twitch user ID)
      username,
      heroId,
      heroName,
      heroRole,
      heroLevel: heroLevel, // Include hero level for display
      message: message.trim(),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      partyId: channel === 'party' ? partyId : null,
      guildId: channel === 'guild' ? guildId : null,
      recipientId: null, // Deprecated - use recipientHeroId for whispers
      recipientHeroId: channel === 'whisper' ? recipientHeroId : null, // Store hero ID for hero-to-hero messaging
      recipientHeroName: channel === 'whisper' ? recipientHeroName : null,
      founderPackTier: founderPackTier // Include for badge display in chat
    };

    const messageRef = await db.collection('chatMessages').add(messageData);
    const messageId = messageRef.id;

    // Broadcast via WebSocket
    try {
      const { broadcastToRoom } = await import('../websocket/server.js');
      
      const messagePayload = {
        id: messageId,
        ...messageData,
        timestamp: Date.now()
      };
      
      // Ensure IDs are strings (should already be normalized, but double-check)
      messagePayload.userId = String(messagePayload.userId);
      messagePayload.heroId = String(messagePayload.heroId);
      if (messagePayload.recipientId) {
        messagePayload.recipientId = String(messagePayload.recipientId);
      }
      if (messagePayload.recipientHeroId) {
        messagePayload.recipientHeroId = String(messagePayload.recipientHeroId);
      }
      
      console.log('[WebChat] Broadcasting message:', {
        channel,
        messageId,
        userId: messagePayload.userId,
        heroId: messagePayload.heroId,
        recipientId: messagePayload.recipientId,
        recipientHeroId: messagePayload.recipientHeroId,
        heroName: messagePayload.heroName,
        message: messagePayload.message?.substring(0, 50)
      });
      
      if (channel === 'party') {
        // Broadcast to party members (via world room for now, filtered on frontend)
        broadcastToRoom('world', {
          type: 'chat:message',
          message: messagePayload
        });
      } else if (channel === 'guild') {
        // Broadcast to guild members (via world room, filtered on frontend)
        console.log('[WebChat] Broadcasting guild message:', {
          guildId: messagePayload.guildId,
          heroId: messagePayload.heroId,
          heroName: messagePayload.heroName,
          message: messagePayload.message?.substring(0, 50)
        });
        broadcastToRoom('world', {
          type: 'chat:message',
          message: messagePayload
        });
      } else if (channel === 'whisper') {
        // Broadcast whisper to 'world' room - frontend will filter based on heroId/recipientHeroId
        // This way both sender and recipient will receive it
        console.log('[WebChat] Broadcasting whisper:', {
          senderUserId: messagePayload.userId,
          senderHeroId: messagePayload.heroId,
          senderHeroName: messagePayload.heroName,
          recipientHeroId: messagePayload.recipientHeroId,
          recipientHeroName: messagePayload.recipientHeroName
        });
        broadcastToRoom('world', {
          type: 'chat:message',
          message: messagePayload
        });
      } else {
        // Broadcast to world chat (all users)
        broadcastToRoom('world', {
          type: 'chat:message',
          message: messagePayload
        });
      }
    } catch (error) {
      console.error('[WebChat] Error broadcasting message:', error);
      // Continue even if broadcast fails - message is still saved
    }

    res.json({
      success: true,
      messageId,
      message: {
        id: messageId,
        ...messageData,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('[WebChat] Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Get chat history
 * GET /api/web-chat/history
 * Query params:
 *   channel: 'party' | 'world' | 'whisper' | 'guild'
 *   partyId?: string (required for party chat)
 *   guildId?: string (required for guild chat)
 *   recipientId?: string (required for whisper - recipient hero ID)
 *   heroId?: string (required for whisper - current user's hero ID)
 *   limit?: number (default: 50)
 */
router.get('/history', async (req, res) => {
  try {
    const { channel, partyId, guildId, recipientId, heroId, limit = 50 } = req.query;

    console.log('[WebChat] History request:', { channel, partyId, guildId, recipientId, heroId, limit });

    if (!channel || (channel !== 'party' && channel !== 'world' && channel !== 'whisper' && channel !== 'guild')) {
      console.error('[WebChat] Invalid channel:', channel);
      return res.status(400).json({ error: 'channel must be "party", "world", "whisper", or "guild"' });
    }

    if (channel === 'party' && !partyId) {
      console.error('[WebChat] Missing partyId for party chat');
      return res.status(400).json({ error: 'partyId required for party chat' });
    }

    if (channel === 'guild' && !guildId) {
      console.error('[WebChat] Missing guildId for guild chat');
      return res.status(400).json({ error: 'guildId required for guild chat' });
    }

    if (channel === 'whisper' && !heroId) {
      console.error('[WebChat] Missing heroId for whisper history');
      return res.status(400).json({ error: 'heroId required for whisper history' });
    }
    
    // For whispers, if no recipientId provided, return all whispers for this hero

    let query = db.collection('chatMessages')
      .where('channel', '==', channel);

    if (channel === 'party') {
      query = query.where('partyId', '==', partyId);
    } else if (channel === 'guild') {
      query = query.where('guildId', '==', guildId);
      console.log('[WebChat] Building guild chat query:', { channel, guildId });
    } else if (channel === 'whisper') {
      // For whispers, get messages where current user is either sender or recipient
      // We'll need to filter in memory since Firestore doesn't support OR queries easily
      query = query.where('channel', '==', 'whisper');
    }

    let snapshot;
    let useFallback = false;
    
    try {
      // Try with orderBy first (requires index)
      snapshot = await query
        .orderBy('timestamp', 'desc')
        .limit(parseInt(limit, 10))
        .get();
    } catch (queryError) {
      // Check if it's an index error
      const isIndexError = queryError.code === 9 || 
                          queryError.code === 'FAILED_PRECONDITION' || 
                          queryError.message?.includes('index') ||
                          queryError.message?.includes('requires an index');
      
      if (isIndexError) {
        console.warn('[WebChat] Index not found, falling back to query without orderBy');
        console.error('[WebChat] Index error details:', queryError.message);
        useFallback = true;
        
        // Fallback: Get messages without orderBy and sort in memory
        try {
          // Get more messages than needed since we'll sort and limit in memory
          let fallbackQuery = db.collection('chatMessages')
            .where('channel', '==', channel);
          
          if (channel === 'party') {
            fallbackQuery = fallbackQuery.where('partyId', '==', partyId);
          } else if (channel === 'guild') {
            fallbackQuery = fallbackQuery.where('guildId', '==', guildId);
          }
          
          snapshot = await fallbackQuery
            .limit(parseInt(limit, 10) * 3) // Get more to account for sorting
            .get();
          
          // Sort in memory by timestamp (descending)
          const sortedDocs = snapshot.docs.sort((a, b) => {
            const aData = a.data();
            const bData = b.data();
            const aTime = aData.timestamp?.toMillis?.() || aData.timestamp || 0;
            const bTime = bData.timestamp?.toMillis?.() || bData.timestamp || 0;
            return bTime - aTime; // Descending
          });
          
          // Create a new snapshot-like object with sorted docs
          snapshot = {
            docs: sortedDocs.slice(0, parseInt(limit, 10)),
            empty: sortedDocs.length === 0,
            size: Math.min(sortedDocs.length, parseInt(limit, 10))
          };
        } catch (fallbackError) {
          console.error('[WebChat] Fallback query also failed:', fallbackError);
          console.error('[WebChat] Fallback error details:', {
            message: fallbackError.message,
            code: fallbackError.code,
            stack: fallbackError.stack
          });
          
          // Try to extract the index creation URL from the original error
          let indexUrl = null;
          if (queryError.message) {
            const urlMatch = queryError.message.match(/https:\/\/[^\s]+/);
            if (urlMatch) {
              indexUrl = urlMatch[0];
            }
          }
          
          // Return a more helpful error message
          return res.status(400).json({ 
            error: 'Firestore index required',
            message: 'A Firestore composite index is needed for this query. Please create it in the Firebase Console.',
            indexUrl: indexUrl,
            details: queryError.message,
            fallbackError: fallbackError.message
          });
        }
      } else {
        // Not an index error, log and re-throw
        console.error('[WebChat] Query error (not index related):', queryError);
        throw queryError;
      }
    }

    let messages = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toMillis() || Date.now()
      };
    });

    console.log('[WebChat] History query successful:', { 
      channel, 
      guildId: channel === 'guild' ? guildId : undefined,
      messageCount: messages.length 
    });

    // For whispers, filter to show only messages involving the current user's hero
    if (channel === 'whisper') {
      const normalizedHeroId = String(heroId || '');
      messages = messages.filter(msg => {
        const normalizedMsgHeroId = String(msg.heroId || '');
        const normalizedMsgRecipientHeroId = String(msg.recipientHeroId || '');
        
        // Show all whispers where current hero is sender or recipient
        const involvesHero = normalizedMsgHeroId === normalizedHeroId || normalizedMsgRecipientHeroId === normalizedHeroId;
        
        if (!involvesHero) return false;
        
        // If recipientId (hero ID) is specified, only show messages with that recipient hero
        if (recipientId) {
          const normalizedRecipientHeroId = String(recipientId);
          return (normalizedMsgHeroId === normalizedHeroId && normalizedMsgRecipientHeroId === normalizedRecipientHeroId) ||
                 (normalizedMsgHeroId === normalizedRecipientHeroId && normalizedMsgRecipientHeroId === normalizedHeroId);
        }
        
        // No recipientId specified - show all whispers involving current hero
        return true;
      });
    }

    // Reverse to show oldest first
    messages.reverse();

    res.json({
      success: true,
      messages
    });

  } catch (error) {
    console.error('[WebChat] Error fetching history:', error);
    console.error('[WebChat] Error stack:', error.stack);
    console.error('[WebChat] Error details:', {
      message: error.message,
      code: error.code,
      name: error.name
    });
    
    // Check if it's a Firestore index error
    const isIndexError = error.code === 9 || 
                        error.code === 'FAILED_PRECONDITION' || 
                        error.message?.includes('index') ||
                        error.message?.includes('requires an index');
    
    if (isIndexError) {
      // Try to extract the index creation URL
      let indexUrl = null;
      if (error.message) {
        const urlMatch = error.message.match(/https:\/\/[^\s]+/);
        if (urlMatch) {
          indexUrl = urlMatch[0];
        }
      }
      
      return res.status(400).json({ 
        error: 'Firestore index required',
        message: 'A Firestore composite index is needed for this query. Please create it in the Firebase Console.',
        indexUrl: indexUrl,
        details: error.message
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch chat history',
      details: error.message,
      code: error.code
    });
  }
});

/**
 * Delete own message
 * DELETE /api/web-chat/message/:messageId
 * Body: { userId: string }
 */
router.delete('/message/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const messageDoc = await db.collection('chatMessages').doc(messageId).get();
    if (!messageDoc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messageDoc.data();
    if (message.userId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await messageDoc.ref.update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Broadcast deletion
    try {
      const { broadcastToRoom } = await import('../websocket/server.js');
      broadcastToRoom('world', {
        type: 'chat:message:deleted',
        messageId
      });
    } catch (error) {
      console.error('[WebChat] Error broadcasting deletion:', error);
    }

    res.json({
      success: true,
      message: 'Message deleted'
    });

  } catch (error) {
    console.error('[WebChat] Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * Block a user
 * POST /api/web-chat/block
 * Body: { userId: string, blockedUserId: string }
 */
router.post('/block', async (req, res) => {
  try {
    const { userId, blockedUserId } = req.body;

    if (!userId || !blockedUserId) {
      return res.status(400).json({ error: 'userId and blockedUserId required' });
    }

    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    // Check if already blocked
    const existingBlock = await db.collection('chatBlocks')
      .where('userId', '==', userId)
      .where('blockedUserId', '==', blockedUserId)
      .limit(1)
      .get();

    if (!existingBlock.empty) {
      return res.status(400).json({ error: 'User already blocked' });
    }

    // Create block record
    await db.collection('chatBlocks').add({
      userId,
      blockedUserId,
      blockedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'User blocked'
    });

  } catch (error) {
    console.error('[WebChat] Error blocking user:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * Unblock a user
 * DELETE /api/web-chat/block
 * Body: { userId: string, blockedUserId: string }
 */
router.delete('/block', async (req, res) => {
  try {
    const { userId, blockedUserId } = req.body;

    if (!userId || !blockedUserId) {
      return res.status(400).json({ error: 'userId and blockedUserId required' });
    }

    // Find and delete block record
    const blockSnapshot = await db.collection('chatBlocks')
      .where('userId', '==', userId)
      .where('blockedUserId', '==', blockedUserId)
      .limit(1)
      .get();

    if (blockSnapshot.empty) {
      return res.status(404).json({ error: 'User not blocked' });
    }

    await blockSnapshot.docs[0].ref.delete();

    res.json({
      success: true,
      message: 'User unblocked'
    });

  } catch (error) {
    console.error('[WebChat] Error unblocking user:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

/**
 * Get blocked users list
 * GET /api/web-chat/blocks/:userId
 */
router.get('/blocks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const blocksSnapshot = await db.collection('chatBlocks')
      .where('userId', '==', userId)
      .get();

    const blockedUserIds = blocksSnapshot.docs.map(doc => doc.data().blockedUserId);

    res.json({
      success: true,
      blockedUserIds
    });

  } catch (error) {
    console.error('[WebChat] Error fetching blocked users:', error);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

/**
 * Report a user or message
 * POST /api/web-chat/report
 * Body: {
 *   reporterId: string,
 *   reportedUserId: string,
 *   reportedMessageId?: string,
 *   reason: string
 * }
 */
router.post('/report', async (req, res) => {
  try {
    const { reporterId, reportedUserId, reportedMessageId, reason } = req.body;

    if (!reporterId || !reportedUserId || !reason) {
      return res.status(400).json({ error: 'reporterId, reportedUserId, and reason required' });
    }

    if (reporterId === reportedUserId) {
      return res.status(400).json({ error: 'Cannot report yourself' });
    }

    // Validate reason
    const validReasons = ['spam', 'harassment', 'inappropriate', 'other'];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid reason. Must be: spam, harassment, inappropriate, or other' });
    }

    // Create report
    const reportRef = await db.collection('chatReports').add({
      reporterId,
      reportedUserId,
      reportedMessageId: reportedMessageId || null,
      reason,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Report submitted',
      reportId: reportRef.id
    });

  } catch (error) {
    console.error('[WebChat] Error creating report:', error);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

/**
 * Get reports (admin only)
 * GET /api/web-chat/reports
 * Query params: status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
 */
router.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    // TODO: Add admin check
    // For now, allow any authenticated user (will add admin check later)

    let query = db.collection('chatReports');

    if (status) {
      query = query.where('status', '==', status);
    }

    const snapshot = await query
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toMillis() || Date.now()
    }));

    res.json({
      success: true,
      reports
    });

  } catch (error) {
    console.error('[WebChat] Error fetching reports:', error);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

/**
 * Delete any message (admin only)
 * DELETE /api/web-chat/admin/message/:messageId
 * Body: { userId: string } (admin userId)
 */
router.delete('/admin/message/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    // TODO: Add admin check
    // For now, allow any authenticated user (will add admin check later)

    const messageDoc = await db.collection('chatMessages').doc(messageId).get();
    if (!messageDoc.exists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    await messageDoc.ref.update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      deletedBy: userId
    });

    // Broadcast deletion
    try {
      const { broadcastToRoom } = await import('../websocket/server.js');
      broadcastToRoom('world', {
        type: 'chat:message:deleted',
        messageId
      });
    } catch (error) {
      console.error('[WebChat] Error broadcasting deletion:', error);
    }

    res.json({
      success: true,
      message: 'Message deleted by admin'
    });

  } catch (error) {
    console.error('[WebChat] Error deleting message (admin):', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

/**
 * Ban user from chat (admin only)
 * POST /api/web-chat/admin/ban
 * Body: { adminId: string, bannedUserId: string, duration?: number (hours) }
 */
router.post('/admin/ban', async (req, res) => {
  try {
    const { adminId, bannedUserId, duration } = req.body;

    if (!adminId || !bannedUserId) {
      return res.status(400).json({ error: 'adminId and bannedUserId required' });
    }

    // TODO: Add admin check
    // For now, allow any authenticated user (will add admin check later)

    const bannedUntil = duration 
      ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + duration * 60 * 60 * 1000))
      : null; // null = permanent ban

    await db.collection('chatBans').add({
      bannedUserId,
      bannedBy: adminId,
      bannedAt: admin.firestore.FieldValue.serverTimestamp(),
      bannedUntil,
      permanent: !duration
    });

    res.json({
      success: true,
      message: duration ? `User banned for ${duration} hours` : 'User permanently banned'
    });

  } catch (error) {
    console.error('[WebChat] Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

/**
 * Unban user from chat (admin only)
 * DELETE /api/web-chat/admin/ban/:bannedUserId
 * Body: { adminId: string }
 */
router.delete('/admin/ban/:bannedUserId', async (req, res) => {
  try {
    const { bannedUserId } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({ error: 'adminId required' });
    }

    // TODO: Add admin check

    // Find active ban
    const banSnapshot = await db.collection('chatBans')
      .where('bannedUserId', '==', bannedUserId)
      .where('permanent', '==', true)
      .get();

    // Also check for temporary bans that haven't expired
    const tempBanSnapshot = await db.collection('chatBans')
      .where('bannedUserId', '==', bannedUserId)
      .where('permanent', '==', false)
      .get();

    const allBans = [...banSnapshot.docs, ...tempBanSnapshot.docs].filter(doc => {
      const data = doc.data();
      if (data.permanent) return true;
      const bannedUntil = data.bannedUntil?.toMillis() || 0;
      return bannedUntil > Date.now();
    });

    if (allBans.length === 0) {
      return res.status(404).json({ error: 'No active ban found' });
    }

    // Delete all active bans
    await Promise.all(allBans.map(doc => doc.ref.delete()));

    res.json({
      success: true,
      message: 'User unbanned'
    });

  } catch (error) {
    console.error('[WebChat] Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

/**
 * Check if user is banned
 * GET /api/web-chat/ban-status/:userId
 */
router.get('/ban-status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Check permanent bans
    const permanentBans = await db.collection('chatBans')
      .where('bannedUserId', '==', userId)
      .where('permanent', '==', true)
      .get();

    // Check temporary bans
    const tempBans = await db.collection('chatBans')
      .where('bannedUserId', '==', userId)
      .where('permanent', '==', false)
      .get();

    const now = Date.now();
    const activeBan = [...permanentBans.docs, ...tempBans.docs].find(doc => {
      const data = doc.data();
      if (data.permanent) return true;
      const bannedUntil = data.bannedUntil?.toMillis() || 0;
      return bannedUntil > now;
    });

    if (!activeBan) {
      return res.json({
        success: true,
        banned: false
      });
    }

    const banData = activeBan.data();
    const bannedUntil = banData.bannedUntil?.toMillis() || null;

    res.json({
      success: true,
      banned: true,
      permanent: banData.permanent,
      bannedUntil: bannedUntil,
      bannedAt: banData.bannedAt?.toMillis() || null
    });

  } catch (error) {
    console.error('[WebChat] Error checking ban status:', error);
    res.status(500).json({ error: 'Failed to check ban status' });
  }
});

export default router;
