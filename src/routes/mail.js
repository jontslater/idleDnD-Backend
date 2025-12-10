import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Mail expiration: 30 days
const MAIL_EXPIRATION_DAYS = 30;
const MAX_MAIL_PER_USER = 50;

/**
 * Send mail to another player
 * POST /api/mail/send
 * Body: {
 *   senderId: string,
 *   senderHeroId: string,
 *   recipientId: string,
 *   subject: string,
 *   message: string,
 *   items?: Array<{ itemId: string, quantity?: number }>,
 *   gold?: number,
 *   tokens?: number,
 *   codAmount?: number (required if items are attached and COD)
 * }
 */
router.post('/send', async (req, res) => {
  try {
    const { senderId, senderHeroId, recipientId, subject, message, items, gold, tokens, codAmount } = req.body;

    if (!senderId || !senderHeroId || !recipientId) {
      return res.status(400).json({ error: 'senderId, senderHeroId, and recipientId required' });
    }

    if (senderId === recipientId) {
      return res.status(400).json({ error: 'Cannot send mail to yourself' });
    }

    if (!subject || !message) {
      return res.status(400).json({ error: 'subject and message required' });
    }

    // Check if recipient exists (recipientId should be a user ID, not hero ID)
    // We can validate by checking if any hero exists with this userId
    // Try multiple ways to find the user's heroes
    let recipientHeroes = await db.collection('heroes')
      .where('twitchUserId', '==', recipientId)
      .limit(1)
      .get();

    // If no match, try converting to number (in case recipientId is a number string)
    if (recipientHeroes.empty && !isNaN(recipientId)) {
      recipientHeroes = await db.collection('heroes')
        .where('twitchUserId', '==', parseInt(recipientId))
        .limit(1)
        .get();
    }

    // If still no match, check if it's a string number match
    if (recipientHeroes.empty) {
      recipientHeroes = await db.collection('heroes')
        .where('twitchUserId', '==', String(recipientId))
        .limit(1)
        .get();
    }

    // Validate that recipient exists (has at least one hero)
    if (recipientHeroes.empty) {
      return res.status(404).json({ error: 'Recipient not found. Make sure the user has created at least one hero.' });
    }

    // Check recipient's mail count
    const recipientMailCount = await db.collection('mail')
      .where('recipientId', '==', recipientId)
      .where('deletedAt', '==', null)
      .get();

    if (recipientMailCount.size >= MAX_MAIL_PER_USER) {
      return res.status(400).json({ error: 'Recipient mail inbox is full (max 50 mails)' });
    }

    // Get sender hero data
    const senderHeroDoc = await db.collection('heroes').doc(senderHeroId).get();
    if (!senderHeroDoc.exists) {
      return res.status(404).json({ error: 'Sender hero not found' });
    }

    const senderHero = senderHeroDoc.data();
    const senderName = senderHero.twitchUsername || senderHero.username || senderHero.name || 'Unknown';
    const senderInventory = senderHero.inventory || [];

    // Validate items if provided
    const itemData = [];
    if (items && items.length > 0) {
      
      for (const itemRequest of items) {
        const requestedQuantity = itemRequest.quantity || 1;
        
        // Find the item by ID first (to get item properties)
        const itemTemplate = senderInventory.find((inv) => inv.id === itemRequest.itemId);
        if (!itemTemplate) {
          return res.status(400).json({ error: `Item ${itemRequest.itemId} not found in sender inventory` });
        }

        // Find all items of the same type (by name) for stacking
        const itemName = itemTemplate.name || '';
        const itemsOfType = senderInventory.filter((inv) => (inv.name || '') === itemName);
        
        // Check if any of these items are equipped (cannot send equipped items)
        const equippedItemIds = new Set(
          Object.values(senderHero.equipment || {})
            .filter(eq => eq && eq.id)
            .map(eq => eq.id)
        );
        
        const availableItemsOfType = itemsOfType.filter(inv => !equippedItemIds.has(inv.id));
        
        // Calculate total available quantity
        const totalAvailable = availableItemsOfType.reduce((sum, inv) => {
          return sum + (inv.quantity || 1);
        }, 0);
        
        if (totalAvailable < requestedQuantity) {
          return res.status(400).json({ 
            error: `Not enough quantity of ${itemName}. Requested: ${requestedQuantity}, Available: ${totalAvailable}` 
          });
        }

        // Use the first available item as the template (they should all have the same properties)
        const representativeItem = availableItemsOfType[0];
        
        itemData.push({
          ...representativeItem,
          quantity: requestedQuantity,
          originalQuantity: totalAvailable
        });
      }

      // If items are attached, COD amount is required if not 0
      if (codAmount === undefined || codAmount === null) {
        return res.status(400).json({ error: 'codAmount required when sending items (use 0 for free)' });
      }

      if (codAmount < 0) {
        return res.status(400).json({ error: 'codAmount cannot be negative' });
      }
    }

    // Validate currency
    const goldAmount = gold || 0;
    const tokenAmount = tokens || 0;

    if (goldAmount < 0 || tokenAmount < 0) {
      return res.status(400).json({ error: 'gold and tokens cannot be negative' });
    }

    // Check if sender has enough currency
    if (goldAmount > 0 && (senderHero.gold || 0) < goldAmount) {
      return res.status(400).json({ error: 'Insufficient gold' });
    }

    if (tokenAmount > 0 && (senderHero.tokens || 0) < tokenAmount) {
      return res.status(400).json({ error: 'Insufficient tokens' });
    }

    // Deduct currency from sender (if sending gold/tokens)
    if (goldAmount > 0 || tokenAmount > 0) {
      const updateData = {};
      if (goldAmount > 0) {
        updateData.gold = admin.firestore.FieldValue.increment(-goldAmount);
      }
      if (tokenAmount > 0) {
        updateData.tokens = admin.firestore.FieldValue.increment(-tokenAmount);
      }
      await senderHeroDoc.ref.update(updateData);
    }

    // Remove items from sender inventory (handle stacking by name)
    if (itemData.length > 0) {
      const updatedInventory = [...senderInventory];
      const equippedItemIds = new Set(
        Object.values(senderHero.equipment || {})
          .filter(eq => eq && eq.id)
          .map(eq => eq.id)
      );
      
      // Process each item type requested
      for (const itemDataEntry of itemData) {
        let remainingToRemove = itemDataEntry.quantity;
        const itemName = itemDataEntry.name || '';
        
        // Process items from the end of the array to avoid index shifting issues
        for (let i = updatedInventory.length - 1; i >= 0 && remainingToRemove > 0; i--) {
          const inv = updatedInventory[i];
          
          // Skip if not the same item type or if equipped
          if ((inv.name || '') !== itemName || equippedItemIds.has(inv.id)) {
            continue;
          }
          
          const itemQuantity = inv.quantity || 1;
          
          if (itemQuantity <= remainingToRemove) {
            // Remove entire item
            updatedInventory.splice(i, 1);
            remainingToRemove -= itemQuantity;
          } else {
            // Reduce quantity
            updatedInventory[i] = {
              ...inv,
              quantity: itemQuantity - remainingToRemove
            };
            remainingToRemove = 0;
          }
        }
        
        if (remainingToRemove > 0) {
          console.error(`Warning: Could not remove all items of type ${itemName}. Remaining: ${remainingToRemove}`);
        }
      }

      await senderHeroDoc.ref.update({ inventory: updatedInventory });
    }

    // Create mail document
    const expiresAt = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + MAIL_EXPIRATION_DAYS * 24 * 60 * 60 * 1000)
    );

    // Normalize recipientId to string for consistency
    const normalizedRecipientId = String(recipientId);

    const mailData = {
      senderId,
      senderHeroId,
      senderName,
      recipientId: normalizedRecipientId,
      subject: subject.trim(),
      message: message.trim(),
      items: itemData,
      gold: goldAmount,
      tokens: tokenAmount,
      codAmount: codAmount || 0,
      read: false,
      claimed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      deletedAt: null
    };

    const mailRef = await db.collection('mail').add(mailData);

    console.log(`[Mail] Mail sent from ${senderId} to ${normalizedRecipientId} (raw: ${recipientId}, mailId: ${mailRef.id})`);

    res.json({
      success: true,
      messageId: mailRef.id,
      message: 'Mail sent successfully'
    });

  } catch (error) {
    console.error('[Mail] Error sending mail:', error);
    res.status(500).json({ error: 'Failed to send mail' });
  }
});

/**
 * Get all mail for a user
 * GET /api/mail/:userId
 * Query params: unreadOnly?: boolean
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { unreadOnly } = req.query;

    // Normalize userId to string for consistency
    const normalizedUserId = String(userId);

    // Try primary query with normalized userId
    let query = db.collection('mail')
      .where('recipientId', '==', normalizedUserId)
      .where('deletedAt', '==', null);

    if (unreadOnly === 'true') {
      query = query.where('read', '==', false);
    }

    // Try to get with orderBy, fallback to sorting in memory if index missing
    let snapshot;
    let needsSort = false;
    let allMails = [];
    
    try {
      snapshot = await query
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      
      allMails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      // If index error, query without orderBy and sort in memory
      if (error.code === 9 || error.message?.includes('index')) {
        snapshot = await query.limit(100).get();
        needsSort = true;
        allMails = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } else {
        throw error;
      }
    }

    // Also try alternate format if userId is numeric (for legacy mail compatibility)
    // If primary query returned empty and userId looks like a number, try number format
    if (allMails.length === 0 && !isNaN(userId) && normalizedUserId !== userId) {
      try {
        const altQuery = db.collection('mail')
          .where('recipientId', '==', parseInt(userId))
          .where('deletedAt', '==', null);
        
        const altSnapshot = await altQuery.limit(100).get();
        allMails = altSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        snapshot = altSnapshot;
        console.log(`[Mail] Found ${allMails.length} mails using alternate number format for userId: ${userId}`);
      } catch (altError) {
        // Ignore alternate query errors
        console.log(`[Mail] Alternate query failed for userId: ${userId}`);
      }
    }

    console.log(`[Mail] Fetching mail for userId: ${normalizedUserId} (raw: ${userId}, found ${allMails.length} documents)`);

    const now = Date.now();
    let mails = allMails
      .map(mailData => {
        const expiresAt = mailData.expiresAt?.toMillis() || 0;
        const isExpired = expiresAt > 0 && expiresAt < now;

        return {
          id: mailData.id,
          ...mailData,
          createdAt: mailData.createdAt?.toMillis() || Date.now(),
          expiresAt: expiresAt || null,
          isExpired,
          daysUntilExpiry: isExpired ? 0 : Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24))
        };
      })
      .filter(mail => !mail.isExpired); // Filter out expired mails

    // Sort by createdAt desc if we didn't use orderBy
    if (needsSort) {
      mails.sort((a, b) => b.createdAt - a.createdAt);
    }

    res.json({
      success: true,
      mails,
      unreadCount: mails.filter(m => !m.read).length
    });

  } catch (error) {
    console.error('[Mail] Error fetching mail:', error);
    
    // If it's an index error, return the index URL to the client
    if (error.code === 9 || error.message?.includes('index')) {
      const indexUrl = error.message?.match(/https:\/\/console\.firebase\.google\.com[^\s]+/) 
        || error.details?.match(/https:\/\/console\.firebase\.google\.com[^\s]+/);
      
      if (indexUrl) {
        return res.status(400).json({ 
          error: 'Firestore index required',
          indexUrl: indexUrl[0],
          message: 'Please create the required Firestore index. Click the link in indexUrl to create it automatically.'
        });
      }
    }
    
    res.status(500).json({ error: 'Failed to fetch mail' });
  }
});

/**
 * Mark mail as read
 * POST /api/mail/:mailId/read
 * Body: { userId: string }
 */
router.post('/:mailId/read', async (req, res) => {
  try {
    const { mailId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const mailDoc = await db.collection('mail').doc(mailId).get();
    if (!mailDoc.exists) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const mail = mailDoc.data();
    if (mail.recipientId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await mailDoc.ref.update({
      read: true,
      readAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Mail marked as read'
    });

  } catch (error) {
    console.error('[Mail] Error marking mail as read:', error);
    res.status(500).json({ error: 'Failed to mark mail as read' });
  }
});

/**
 * Claim items/gold from mail (with COD payment if required)
 * POST /api/mail/:mailId/claim
 * Body: { userId: string, heroId: string }
 */
router.post('/:mailId/claim', async (req, res) => {
  try {
    const { mailId } = req.params;
    const { userId, heroId } = req.body;

    if (!userId || !heroId) {
      return res.status(400).json({ error: 'userId and heroId required' });
    }

    const mailDoc = await db.collection('mail').doc(mailId).get();
    if (!mailDoc.exists) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const mail = mailDoc.data();

    // Check if mail belongs to recipient
    if (mail.recipientId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Check if already claimed
    if (mail.claimed) {
      return res.status(400).json({ error: 'Mail already claimed' });
    }

    // Check if expired
    const expiresAt = mail.expiresAt?.toMillis() || 0;
    if (expiresAt > 0 && expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Mail has expired' });
    }

    // Get recipient hero
    const recipientHeroDoc = await db.collection('heroes').doc(heroId).get();
    if (!recipientHeroDoc.exists) {
      return res.status(404).json({ error: 'Recipient hero not found' });
    }

    const recipientHero = recipientHeroDoc.data();

    // Check COD payment if required
    if (mail.codAmount && mail.codAmount > 0) {
      // Check if recipient has enough gold
      const recipientGold = recipientHero.gold || 0;
      if (recipientGold < mail.codAmount) {
        return res.status(400).json({ 
          error: `Insufficient gold. COD amount: ${mail.codAmount}g, you have: ${recipientGold}g` 
        });
      }

      // Deduct COD amount from recipient
      await recipientHeroDoc.ref.update({
        gold: admin.firestore.FieldValue.increment(-mail.codAmount)
      });

      // Send COD payment to sender
      const senderHeroDoc = await db.collection('heroes').doc(mail.senderHeroId).get();
      if (senderHeroDoc.exists) {
        await senderHeroDoc.ref.update({
          gold: admin.firestore.FieldValue.increment(mail.codAmount)
        });
        console.log(`[Mail] COD payment: ${mail.codAmount}g sent from recipient ${userId} to sender ${mail.senderId} (hero: ${mail.senderHeroId})`);
      } else {
        console.warn(`[Mail] COD payment: Sender hero ${mail.senderHeroId} not found, COD payment not sent`);
      }

      console.log(`[Mail] COD payment: ${mail.codAmount}g deducted from recipient ${userId} (hero: ${heroId})`);
    }

    // Add items to recipient inventory
    if (mail.items && mail.items.length > 0) {
      const recipientInventory = recipientHero.inventory || [];
      
      for (const item of mail.items) {
        // Check if item already exists (for stacking)
        const existingItemIndex = recipientInventory.findIndex((inv) => 
          inv.id === item.id || 
          (inv.recipeKey === item.recipeKey && inv.type === item.type && inv.rarity === item.rarity)
        );

        if (existingItemIndex !== -1) {
          // Stack items
          const existingItem = recipientInventory[existingItemIndex];
          const maxStack = item.maxStack || 10;
          const quantity = item.quantity || 1;
          
          if (existingItem.quantity && existingItem.quantity < maxStack) {
            const spaceLeft = maxStack - existingItem.quantity;
            const toAdd = Math.min(quantity, spaceLeft);
            
            recipientInventory[existingItemIndex] = {
              ...existingItem,
              quantity: existingItem.quantity + toAdd
            };

            // If there's leftover, create new item
            if (toAdd < quantity) {
              recipientInventory.push({
                ...item,
                quantity: quantity - toAdd
              });
            }
          } else {
            // Full stack, add as new item
            recipientInventory.push(item);
          }
        } else {
          // New item, add to inventory
          recipientInventory.push(item);
        }
      }

      await recipientHeroDoc.ref.update({ inventory: recipientInventory });
    }

    // Add gold to recipient
    if (mail.gold && mail.gold > 0) {
      await recipientHeroDoc.ref.update({
        gold: admin.firestore.FieldValue.increment(mail.gold)
      });
    }

    // Add tokens to recipient
    if (mail.tokens && mail.tokens > 0) {
      await recipientHeroDoc.ref.update({
        tokens: admin.firestore.FieldValue.increment(mail.tokens)
      });
    }

    // Mark mail as claimed
    await mailDoc.ref.update({
      claimed: true,
      claimedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`[Mail] Mail ${mailId} claimed by ${userId}`);

    res.json({
      success: true,
      message: 'Mail claimed successfully',
      codPaid: mail.codAmount || 0
    });

  } catch (error) {
    console.error('[Mail] Error claiming mail:', error);
    res.status(500).json({ error: 'Failed to claim mail' });
  }
});

/**
 * Delete mail
 * DELETE /api/mail/:mailId
 * Body: { userId: string }
 */
router.delete('/:mailId', async (req, res) => {
  try {
    const { mailId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }

    const mailDoc = await db.collection('mail').doc(mailId).get();
    if (!mailDoc.exists) {
      return res.status(404).json({ error: 'Mail not found' });
    }

    const mail = mailDoc.data();
    if (mail.recipientId !== userId && mail.senderId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await mailDoc.ref.update({
      deletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      message: 'Mail deleted'
    });

  } catch (error) {
    console.error('[Mail] Error deleting mail:', error);
    res.status(500).json({ error: 'Failed to delete mail' });
  }
});

export default router;
