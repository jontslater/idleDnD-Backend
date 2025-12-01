import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { getEnchantmentById, getEnchantmentsForSlot } from '../data/enchantments.js';

const router = express.Router();

// Apply enchantment to item
router.post('/:userId/enchant', async (req, res) => {
  try {
    const { userId } = req.params;
    const { itemId, enchantmentType, enchantmentLevel } = req.body;
    
    if (!itemId || !enchantmentType || !enchantmentLevel) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (enchantmentLevel < 1 || enchantmentLevel > 10) {
      return res.status(400).json({ error: 'Enchantment level must be 1-10' });
    }
    
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = doc.data();
    const equipment = hero.equipment || {};
    
    // Find item in equipment
    let item = null;
    let itemSlot = null;
    
    for (const [slot, equippedItem] of Object.entries(equipment)) {
      if (equippedItem && equippedItem.id === itemId) {
        item = equippedItem;
        itemSlot = slot;
        break;
      }
    }
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found in equipment' });
    }
    
    // Validate enchantment type and slot compatibility
    const enchantmentDef = getEnchantmentById(enchantmentType);
    if (!enchantmentDef) {
      return res.status(400).json({ error: 'Invalid enchantment type' });
    }
    
    if (!enchantmentDef.applicableSlots.includes(itemSlot)) {
      return res.status(400).json({ 
        error: `${enchantmentDef.name} can only be applied to ${enchantmentDef.applicableSlots.join(', ')} slots` 
      });
    }
    
    // Check enchanting profession level
    if (!hero.profession || hero.profession.type !== 'enchanting') {
      return res.status(400).json({ error: 'Enchanting profession required' });
    }
    
    const enchantingLevel = hero.profession.level || 0;
    if (enchantingLevel < enchantmentLevel) {
      return res.status(400).json({ error: `Need enchanting level ${enchantmentLevel}` });
    }
    
    // Calculate material cost
    const essenceCost = enchantmentLevel * 10; // 10, 20, 30, etc.
    const essence = hero.profession.materials?.essence || 0;
    
    if (essence < essenceCost) {
      return res.status(400).json({ 
        error: `Not enough essence. Need ${essenceCost}, have ${essence}` 
      });
    }
    
    // Check if item already has a profession upgrade (only one buff per item)
    let hasProfessionUpgrade = false;
    for (const [slot, equippedItem] of Object.entries(equipment)) {
      if (equippedItem && equippedItem.id === itemId && equippedItem.appliedUpgrades && equippedItem.appliedUpgrades.length > 0) {
        hasProfessionUpgrade = true;
        break;
      }
    }
    
    if (hasProfessionUpgrade) {
      return res.status(400).json({ 
        error: 'Item already has a profession upgrade. Remove it first or use a different item.' 
      });
    }
    
    // Check for existing enchantment on this item (only one enchantment per item)
    const enchantedItems = hero.enchantedItems || [];
    const existingEnchantmentIndex = enchantedItems.findIndex(ei => ei.itemId === itemId);
    const existingEnchantment = existingEnchantmentIndex >= 0 ? enchantedItems[existingEnchantmentIndex] : null;
    
    // Check if the same enchantment type already exists (prevent duplicates)
    if (existingEnchantment) {
      const hasSameEnchantment = existingEnchantment.enchantments.some(e => e.type === enchantmentType);
      if (hasSameEnchantment) {
        return res.status(400).json({ 
          error: `This item already has ${enchantmentType} enchantment. Cannot apply the same enchantment twice.` 
        });
      }
    }
    
    // Apply enchantment (only one enchantment per item, allow overwriting with different type)
    const enchantment = {
      type: enchantmentType,
      level: enchantmentLevel,
      materialCost: essenceCost,
      appliedAt: admin.firestore.Timestamp.now()
    };
    
    if (existingEnchantment) {
      // Overwrite existing enchantment with new one (different type)
      existingEnchantment.enchantments = [enchantment];
    } else {
      // Add new enchantment entry
      enchantedItems.push({
        itemId,
        enchantments: [enchantment]
      });
    }
    
    // Deduct essence
    const professionMaterials = hero.profession.materials || {};
    professionMaterials.essence = essence - essenceCost;
    
    await heroRef.update({
      enchantedItems,
      'profession.materials': professionMaterials,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✨ ${userId} enchanted ${item.name} with ${enchantmentType} level ${enchantmentLevel}`);
    
    res.json({
      success: true,
      message: `Enchantment applied!`,
      enchantment,
      essenceRemaining: essence - essenceCost
    });
  } catch (error) {
    console.error('Error applying enchantment:', error);
    res.status(500).json({ error: 'Failed to apply enchantment' });
  }
});

// Get hero's enchanted items
router.get('/:userId/enchantments', async (req, res) => {
  try {
    const heroRef = db.collection('heroes').doc(req.params.userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = doc.data();
    const enchantedItems = hero.enchantedItems || [];
    
    res.json(enchantedItems);
  } catch (error) {
    console.error('Error fetching enchantments:', error);
    res.status(500).json({ error: 'Failed to fetch enchantments' });
  }
});

// Get available enchantments for a slot
router.get('/enchantments/:slot', (req, res) => {
  try {
    const { slot } = req.params;
    const enchantments = getEnchantmentsForSlot(slot);
    res.json(enchantments);
  } catch (error) {
    console.error('Error fetching enchantments for slot:', error);
    res.status(500).json({ error: 'Failed to fetch enchantments' });
  }
});

// Get all enchantments
router.get('/enchantments', (req, res) => {
  try {
    const { ENCHANTMENTS } = require('../data/enchantments.js');
    res.json(Object.values(ENCHANTMENTS));
  } catch (error) {
    console.error('Error fetching all enchantments:', error);
    res.status(500).json({ error: 'Failed to fetch enchantments' });
  }
});

export default router;
