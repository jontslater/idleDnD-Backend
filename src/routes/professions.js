import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

/**
 * Calculate XP gained from crafting
 */
function calculateCraftingXP(professionType, recipeKey, tier, quantity) {
  // Base XP by profession type and recipe complexity
  let baseXP = 10;
  
  // Herbalism: XP based on recipe tier
  if (professionType === 'herbalism') {
    if (recipeKey.includes('basic')) baseXP = 15;
    else if (recipeKey.includes('powerful')) baseXP = 30;
    else if (recipeKey.includes('superior')) baseXP = 50;
    else if (recipeKey.includes('legendary')) baseXP = 80;
  }
  // Mining: XP based on material tier
  else if (professionType === 'mining') {
    if (recipeKey.includes('iron') || recipeKey.includes('basic')) baseXP = 20;
    else if (recipeKey.includes('steel')) baseXP = 40;
    else if (recipeKey.includes('mithril')) baseXP = 70;
    else if (recipeKey.includes('adamantite')) baseXP = 120;
  }
  // Enchanting: XP based on enchantment power
  else if (professionType === 'enchanting') {
    if (recipeKey.includes('rune')) baseXP = 15; // Runes give less XP
    else if (recipeKey.includes('minor')) baseXP = 25;
    else if (recipeKey.includes('fiery') || recipeKey.includes('vampiric')) baseXP = 45;
    else if (recipeKey.includes('arcane') || recipeKey.includes('legendary')) baseXP = 75;
  }
  
  // Tier multiplier (higher tier = more XP)
  const tierMultiplier = tier;
  
  // Quantity multiplier (slightly reduced per additional craft)
  const quantityXP = baseXP + (Math.max(0, quantity - 1) * baseXP * 0.5);
  
  return Math.floor(quantityXP * tierMultiplier);
}

/**
 * Choose a profession
 * POST /api/heroes/:userId/profession
 */
router.post('/:userId/profession', async (req, res) => {
  try {
    const { type } = req.body;
    const { userId } = req.params;

    console.log(`📝 Profession selection request: userId=${userId}, type=${type}`);

    if (!['herbalism', 'mining', 'enchanting'].includes(type)) {
      return res.status(400).json({ error: 'Invalid profession type' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      console.log(`❌ Hero not found: ${userId}`);
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();

    // Allow changing professions (resets progress)
    const isChanging = hero.profession !== null && hero.profession !== undefined;
    if (isChanging) {
      console.log(`🔄 Changing profession from ${hero.profession.type} to ${type}`);
    }

    // Initialize profession (inventory now stored in hero.inventory directly)
    const professionData = {
      type,
      level: 1,
      xp: 0,
      maxXp: 100,
      materials: type === 'herbalism' ? {
        herbs: { common: 0, uncommon: 0, rare: 0, epic: 0 }
      } : type === 'mining' ? {
        ore: { iron: 0, steel: 0, mithril: 0, adamantite: 0 }
      } : {
        essence: 0
      },
      totalGathered: 0,
      totalCrafted: 0,
      lastGatherTime: Date.now()
    };

    console.log(`💾 Attempting to update profession for hero ${userId}...`);
    console.log('Profession data:', JSON.stringify(professionData, null, 2));
    
    const updateResult = await heroRef.update({
      profession: professionData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Profession ${type} set for hero ${userId}`);
    console.log('Update result:', updateResult);
    
    // Verify it was saved
    const updatedDoc = await heroRef.get();
    const updatedHero = updatedDoc.data();
    console.log('Verified profession in Firebase:', updatedHero.profession?.type || 'NULL');
    
    res.json({ success: true, profession: professionData });
  } catch (error) {
    console.error('Error choosing profession:', error);
    res.status(500).json({ error: 'Failed to choose profession' });
  }
});

/**
 * Craft an item
 * POST /api/professions/:userId/craft
 */
router.post('/:userId/craft', async (req, res) => {
  try {
    const { recipeKey } = req.body;
    const { userId } = req.params;

    console.log(`🔨 Craft request: userId=${userId}, recipe=${recipeKey}`);

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();

    if (!hero.profession) {
      return res.status(400).json({ error: 'No profession chosen' });
    }

    const profession = hero.profession;

    // Initialize hero inventory if it doesn't exist
    if (!hero.inventory) {
      console.log(`⚠️ Hero inventory was null, initializing...`);
      hero.inventory = [];
    }

    console.log(`📦 Current inventory:`, hero.inventory.length, 'items');
    console.log(`💎 Current materials:`, JSON.stringify(profession.materials));

    // Get recipe costs from req.body
    const recipeCost = req.body.cost || {};
    const quantity = req.body.quantity || 1;
    console.log(`🔨 Crafting ${quantity}x ${recipeKey} with cost:`, JSON.stringify(recipeCost));

    // Validate and deduct materials
    if (profession.type === 'herbalism' && recipeCost.herbs) {
      for (const [mat, cost] of Object.entries(recipeCost.herbs)) {
        const have = profession.materials.herbs?.[mat] || 0;
        const needed = cost * quantity;
        if (have < needed) {
          return res.status(400).json({ error: `Not enough ${mat} herbs. Need ${needed}, have ${have}` });
        }
      }
      // Deduct materials
      for (const [mat, cost] of Object.entries(recipeCost.herbs)) {
        profession.materials.herbs[mat] -= cost * quantity;
      }
    } else if (profession.type === 'mining' && recipeCost.ore) {
      for (const [mat, cost] of Object.entries(recipeCost.ore)) {
        const have = profession.materials.ore?.[mat] || 0;
        const needed = cost * quantity;
        if (have < needed) {
          return res.status(400).json({ error: `Not enough ${mat} ore. Need ${needed}, have ${have}` });
        }
      }
      // Deduct materials
      for (const [mat, cost] of Object.entries(recipeCost.ore)) {
        profession.materials.ore[mat] -= cost * quantity;
      }
    } else if (profession.type === 'enchanting' && recipeCost.essence) {
      const have = profession.materials.essence || 0;
      const needed = recipeCost.essence * quantity;
      if (have < needed) {
        return res.status(400).json({ error: `Not enough essence. Need ${needed}, have ${have}` });
      }
      // Deduct materials
      profession.materials.essence -= recipeCost.essence * quantity;
    }

    const itemId = `${recipeKey}_${Date.now()}`;
    
    // Get recipe info for item name
    const allRecipes = profession.type === 'herbalism' 
      ? { /* herbalism recipes */ }
      : profession.type === 'mining' 
        ? { /* mining recipes */ }
        : { /* enchanting recipes */ };
    
    // Create the crafted item as a regular inventory item
    const craftedItem = {
      id: itemId,
      name: recipeKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      slot: 'consumable', // Mark as profession item
      rarity: 'common',
      attack: 0,
      defense: 0,
      hp: 0,
      color: profession.type === 'herbalism' ? '#10b981' : profession.type === 'mining' ? '#f97316' : '#a855f7',
      // Profession-specific metadata
      professionItem: true,
      professionType: profession.type,
      recipeKey,
      tier: req.body.tier || 1,
      quantity,
      craftedAt: Date.now()
    };

    // Add to hero's main inventory (simple array)
    hero.inventory.push(craftedItem);

    // Award profession XP for crafting
    const xpGain = calculateCraftingXP(profession.type, recipeKey, req.body.tier, quantity);
    profession.xp += xpGain;
    profession.totalCrafted += quantity;

    // Check for level up
    let leveledUp = false;
    while (profession.xp >= profession.maxXp && profession.level < 100) {
      profession.xp -= profession.maxXp;
      profession.level += 1;
      profession.maxXp = Math.floor(profession.maxXp * 1.15); // 15% more XP per level
      leveledUp = true;
    }

    console.log(`💾 Saving to Firestore...`);
    console.log(`📝 Hero inventory before save:`, hero.inventory.length, 'items');
    console.log(`⭐ Profession XP gained: +${xpGain} (${profession.xp}/${profession.maxXp})${leveledUp ? ' 🎉 LEVEL UP!' : ''}`);
    console.log(`🔍 Crafted item being added:`, JSON.stringify(craftedItem));
    console.log(`📋 Full inventory array:`, JSON.stringify(hero.inventory, null, 2));
    
    // Update profession (materials, XP, level) and hero inventory
    try {
      const updateData = {
        profession: profession,
        inventory: hero.inventory,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      console.log(`📤 Sending update to Firestore...`);
      
      await heroRef.update(updateData);
      console.log(`✅ Update complete`);
    } catch (updateError) {
      console.error(`❌ Firestore update error:`, updateError);
      throw updateError;
    }

    // Verify it saved
    console.log(`🔍 Fetching document to verify...`);
    const verifyDoc = await heroRef.get();
    const verifyData = verifyDoc.data();
    console.log(`📦 Inventory after save: ${verifyData.inventory?.length || 0} total items`);
    console.log(`🔍 Full verified inventory:`, JSON.stringify(verifyData.inventory || [], null, 2));
    
    if (verifyData.inventory && verifyData.inventory.length > 0) {
      const lastItem = verifyData.inventory[verifyData.inventory.length - 1];
      console.log(`✅ Last item in Firebase:`, JSON.stringify(lastItem));
    } else {
      console.error(`❌ WARNING: Inventory is empty or undefined in Firebase!`);
    }
    
    res.json({ 
      success: true, 
      message: leveledUp 
        ? `Crafted ${quantity}x ${recipeKey}! 🎉 Profession level up! Now level ${profession.level}!`
        : `Crafted ${quantity}x ${recipeKey}! +${xpGain} XP`,
      item: craftedItem,
      materials: profession.materials,
      profession: {
        level: profession.level,
        xp: profession.xp,
        maxXp: profession.maxXp
      },
      xpGained: xpGain,
      leveledUp
    });

  } catch (error) {
    console.error('Error crafting:', error);
    res.status(500).json({ error: 'Failed to craft item' });
  }
});

/**
 * Apply upgrade/enchantment to gear
 * POST /api/professions/:userId/apply
 */
router.post('/:userId/apply', async (req, res) => {
  try {
    const { itemId, equipmentSlot } = req.body;
    const { userId } = req.params;

    console.log(`⚒️ Apply request: userId=${userId}, itemId=${itemId}, slot=${equipmentSlot}`);

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();

    console.log(`📊 Hero data check:`);
    console.log(`  - Inventory exists: ${!!hero.inventory}`);
    console.log(`  - Inventory length: ${hero.inventory?.length || 0}`);
    console.log(`  - Equipment exists: ${!!hero.equipment}`);
    console.log(`  - Equipment keys: ${hero.equipment ? Object.keys(hero.equipment).join(', ') : 'none'}`);

    if (!hero.inventory) {
      console.log(`❌ Hero inventory is null/undefined`);
      return res.status(400).json({ error: 'Hero inventory not initialized' });
    }

    // Find the item in hero's inventory
    const itemIndex = hero.inventory.findIndex(item => item.id === itemId);
    
    if (itemIndex === -1) {
      console.log(`❌ Item ${itemId} not found in inventory of ${hero.inventory.length} items`);
      console.log(`📋 Inventory items:`, hero.inventory.map(i => ({ id: i.id, name: i.name })));
      return res.status(404).json({ error: 'Item not found in inventory' });
    }

    const foundItem = hero.inventory[itemIndex];
    const foundRecipeKey = foundItem.recipeKey;

    console.log(`🔍 Found item:`, JSON.stringify(foundItem));
    console.log(`🎽 Equipment structure:`, JSON.stringify(hero.equipment || {}));
    console.log(`🎯 Target slot:`, equipmentSlot);

    // Verify it's a profession item
    if (!foundItem.professionItem) {
      console.log(`❌ Item is not a profession item`);
      return res.status(400).json({ error: 'This item cannot be applied to gear' });
    }

    // Initialize equipment if it doesn't exist
    if (!hero.equipment) {
      console.log(`⚠️ No equipment object, initializing...`);
      hero.equipment = {
        weapon: null,
        armor: null,
        accessory: null,
        shield: null
      };
    }

    // Check if gear exists in equipment slot
    if (!hero.equipment[equipmentSlot]) {
      console.log(`❌ No equipment in slot: ${equipmentSlot}`);
      console.log(`📋 Available equipment:`, Object.keys(hero.equipment).filter(k => hero.equipment[k] !== null));
      return res.status(400).json({ 
        error: `No equipment in ${equipmentSlot} slot. Equip something first before applying upgrades.`,
        availableSlots: Object.keys(hero.equipment).filter(k => hero.equipment[k] !== null)
      });
    }

    const equipment = hero.equipment[equipmentSlot];
    console.log(`✅ Found equipment in ${equipmentSlot}:`, equipment.name);
    
    // Apply the upgrade/enchantment based on profession type
    let upgradeApplied = false;
    let statBonus = {};
    const professionType = foundItem.professionType;

    if (professionType === 'mining') {
      // Mining upgrades: Add flat stats based on tier
      const tierMultiplier = foundItem.tier;
      statBonus = {
        attack: (foundRecipeKey.includes('plating') || foundRecipeKey.includes('coating')) ? 0 : Math.floor(5 * tierMultiplier),
        defense: (foundRecipeKey.includes('plating') || foundRecipeKey.includes('coating')) ? Math.floor(5 * tierMultiplier) : 0,
        hp: foundRecipeKey.includes('reinforcement') ? Math.floor(20 * tierMultiplier) : 0
      };
      upgradeApplied = true;
    } else if (professionType === 'enchanting') {
      // Enchanting: Special effects and % bonuses
      const tierMultiplier = foundItem.tier;
      if (foundRecipeKey.includes('fiery')) {
        statBonus = { attack: Math.floor(3 * tierMultiplier) };
      } else if (foundRecipeKey.includes('vampiric')) {
        statBonus = { hp: Math.floor(15 * tierMultiplier) };
      } else if (foundRecipeKey.includes('arcane')) {
        statBonus = { attack: Math.floor(4 * tierMultiplier), defense: Math.floor(2 * tierMultiplier) };
      }
      upgradeApplied = true;
    }

    if (!upgradeApplied) {
      return res.status(400).json({ error: 'Cannot apply this item type to gear' });
    }

    // Apply bonuses to equipment
    equipment.attack = (equipment.attack || 0) + (statBonus.attack || 0);
    equipment.defense = (equipment.defense || 0) + (statBonus.defense || 0);
    equipment.hp = (equipment.hp || 0) + (statBonus.hp || 0);

    // Track applied upgrades
    if (!equipment.appliedUpgrades) {
      equipment.appliedUpgrades = [];
    }
    equipment.appliedUpgrades.push({
      recipeKey: foundRecipeKey,
      itemId: foundItem.id,
      appliedAt: Date.now(),
      bonus: statBonus
    });

    // Remove item from inventory (consume it)
    hero.inventory.splice(itemIndex, 1);

    // Update equipment and inventory
    hero.equipment[equipmentSlot] = equipment;

    await heroRef.update({
      equipment: hero.equipment,
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ Applied ${foundRecipeKey} to ${equipmentSlot}: ${JSON.stringify(statBonus)}`);
    
    res.json({ 
      success: true, 
      message: `Applied ${foundRecipeKey.replace(/_/g, ' ')} to ${equipment.name}!`,
      equipment,
      bonus: statBonus
    });
  } catch (error) {
    console.error('Error applying upgrade:', error);
    res.status(500).json({ error: 'Failed to apply upgrade' });
  }
});

/**
 * Use a consumable
 * POST /api/professions/:userId/use
 */
router.post('/:userId/use', async (req, res) => {
  try {
    const { itemKey } = req.body;
    const { userId } = req.params;

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    // TODO: Apply buff effects and remove from inventory
    res.json({ success: true, message: `Used ${itemKey}!` });
  } catch (error) {
    console.error('Error using item:', error);
    res.status(500).json({ error: 'Failed to use item' });
  }
});

/**
 * Equip an item
 * POST /api/heroes/:userId/equip
 */
router.post('/:userId/equip', async (req, res) => {
  try {
    const { slot, item } = req.body;
    const { userId } = req.params;

    if (!['weapon', 'armor', 'accessory', 'shield'].includes(slot)) {
      return res.status(400).json({ error: 'Invalid equipment slot' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    // Update equipment
    await heroRef.update({
      [`equipment.${slot}`]: item,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Item equipped' });
  } catch (error) {
    console.error('Error equipping item:', error);
    res.status(500).json({ error: 'Failed to equip item' });
  }
});

/**
 * Unequip an item
 * POST /api/heroes/:userId/unequip
 */
router.post('/:userId/unequip', async (req, res) => {
  try {
    const { slot } = req.body;
    const { userId } = req.params;

    if (!['weapon', 'armor', 'accessory', 'shield'].includes(slot)) {
      return res.status(400).json({ error: 'Invalid equipment slot' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    // Unequip (set to null)
    await heroRef.update({
      [`equipment.${slot}`]: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Item unequipped' });
  } catch (error) {
    console.error('Error unequipping item:', error);
    res.status(500).json({ error: 'Failed to unequip item' });
  }
});

export default router;
