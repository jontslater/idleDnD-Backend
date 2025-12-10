import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

/**
 * Generate gem stats based on type and rarity
 */
function generateGemStats(gemType, rarity) {
  const stats = {};
  
  switch (gemType) {
    case 'ruby':
      switch (rarity) {
        case 'common': stats.attack = 5; break;
        case 'uncommon': stats.attack = 10; break;
        case 'rare': stats.attack = 15; stats.critChance = 2; break;
        case 'epic': stats.attack = 25; stats.critChance = 5; break;
        case 'legendary': stats.attack = 40; stats.critChance = 8; stats.critDamage = 5; break;
      }
      break;
    case 'sapphire':
      switch (rarity) {
        case 'common': stats.defense = 5; break;
        case 'uncommon': stats.defense = 10; break;
        case 'rare': stats.defense = 15; stats.damageReduction = 2; break;
        case 'epic': stats.defense = 25; stats.damageReduction = 5; break;
        case 'legendary': stats.defense = 40; stats.damageReduction = 8; stats.maxHp = 5; break;
      }
      break;
    case 'emerald':
      switch (rarity) {
        case 'common': stats.attack = 3; stats.defense = 3; break;
        case 'uncommon': stats.attack = 6; stats.defense = 6; break;
        case 'rare': stats.attack = 10; stats.defense = 10; stats.allStats = 1; break;
        case 'epic': stats.attack = 18; stats.defense = 18; stats.allStats = 3; break;
        case 'legendary': stats.attack = 30; stats.defense = 30; stats.allStats = 5; break;
      }
      break;
    case 'diamond':
      switch (rarity) {
        case 'common': stats.xpGain = 5; break;
        case 'uncommon': stats.xpGain = 10; break;
        case 'rare': stats.xpGain = 15; stats.goldGain = 2; break;
        case 'epic': stats.xpGain = 25; stats.goldGain = 5; break;
        case 'legendary': stats.xpGain = 40; stats.goldGain = 10; stats.tokenGain = 5; break;
      }
      break;
  }
  
  return stats;
}

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
        ore: { iron: 0, steel: 0, mithril: 0, adamantite: 0 },
        gems: {
          ruby: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
          sapphire: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
          emerald: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
          diamond: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
        }
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
    }
    
    // Special handling for gem_socket recipe (requires gold)
    if (recipeKey === 'gem_socket') {
      const socketCost = 500; // Cost when crafting socket item
      const heroGold = hero.gold || 0;
      if (heroGold < socketCost * quantity) {
        return res.status(400).json({ error: `Not enough gold. Need ${socketCost * quantity}g, have ${heroGold}g` });
      }
      // Deduct gold
      await heroRef.update({
        gold: heroGold - (socketCost * quantity),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
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
    
    // Determine applicable slots based on recipe key and profession type
    let applicableSlots = [];
    if (profession.type === 'mining') {
      // Mining: weapon upgrades go to weapons, armor upgrades go to armor
      if (recipeKey.includes('whetstone') || recipeKey.includes('oil') || recipeKey.includes('core') || recipeKey.includes('edge')) {
        applicableSlots = ['weapon'];
      } else if (recipeKey.includes('plating') || recipeKey.includes('reinforcement') || recipeKey.includes('enhancement') || recipeKey.includes('fortification')) {
        applicableSlots = ['armor', 'helm', 'cloak', 'gloves', 'boots', 'shield'];
      }
    } else if (profession.type === 'enchanting') {
      // Enchanting: weapon enchants go to weapons, armor enchants go to armor, some go to all
      if (recipeKey.includes('fiery_weapon') || recipeKey.includes('vampiric')) {
        applicableSlots = ['weapon'];
      } else if (recipeKey.includes('frozen_armor') || recipeKey.includes('thorns')) {
        applicableSlots = ['armor', 'helm', 'cloak', 'gloves', 'boots', 'shield'];
      } else if (recipeKey.includes('swiftness') || recipeKey.includes('resilience')) {
        applicableSlots = ['weapon', 'armor', 'accessory', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots', 'shield'];
      } else if (recipeKey.includes('rune')) {
        applicableSlots = []; // Runes are consumables
      }
    } else if (profession.type === 'herbalism') {
      applicableSlots = []; // All herbalism items are consumables
    }

    // Special handling for gem_socket recipe
    let craftedItem;
    if (recipeKey === 'gem_socket') {
      // Check if socket item already exists in inventory (stack up to 10)
      const existingSocketItem = hero.inventory.find(item => 
        (item.type === 'socket' || item.recipeKey === 'gem_socket') && 
        item.professionType === 'mining'
      );
      
      if (existingSocketItem && (existingSocketItem.quantity || 1) < 10) {
        // Stack with existing socket item
        const currentQuantity = existingSocketItem.quantity || 1;
        const newQuantity = Math.min(currentQuantity + quantity, 10);
        const addedQuantity = newQuantity - currentQuantity;
        
        existingSocketItem.quantity = newQuantity;
        
        // If we couldn't add all items, create new ones for the remainder
        if (addedQuantity < quantity) {
          const remaining = quantity - addedQuantity;
          for (let i = 0; i < remaining; i++) {
            const additionalSocketItem = {
              id: `${recipeKey}_${Date.now()}_${i}`,
              name: 'Gem Socket',
              slot: 'consumable',
              rarity: 'common',
              attack: 0,
              defense: 0,
              hp: 0,
              color: '#f97316',
              professionItem: true,
              professionType: 'mining',
              recipeKey: 'gem_socket',
              type: 'socket',
              tier: 1,
              quantity: 1,
              craftedAt: Date.now()
            };
            hero.inventory.push(additionalSocketItem);
          }
        }
        
        // Don't add craftedItem since we stacked it
        craftedItem = null;
      } else {
        // Create new socket item(s)
        craftedItem = {
          id: itemId,
          name: 'Gem Socket',
          slot: 'consumable',
          rarity: 'common',
          attack: 0,
          defense: 0,
          hp: 0,
          color: '#f97316',
          professionItem: true,
          professionType: 'mining',
          recipeKey: 'gem_socket',
          type: 'socket',
          tier: 1,
          quantity: Math.min(quantity, 10), // Stack up to 10
          craftedAt: Date.now()
        };
        
        // If quantity > 10, create additional items
        if (quantity > 10) {
          const remaining = quantity - 10;
          for (let i = 0; i < remaining; i++) {
            const additionalSocketItem = {
              id: `${recipeKey}_${Date.now()}_${i}`,
              name: 'Gem Socket',
              slot: 'consumable',
              rarity: 'common',
              attack: 0,
              defense: 0,
              hp: 0,
              color: '#f97316',
              professionItem: true,
              professionType: 'mining',
              recipeKey: 'gem_socket',
              type: 'socket',
              tier: 1,
              quantity: i < remaining - 1 ? 10 : (remaining % 10 || 10), // Fill stacks of 10
              craftedAt: Date.now()
            };
            hero.inventory.push(additionalSocketItem);
          }
        }
      }
    } else {
      // Regular crafted item
      craftedItem = {
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
        applicableSlots, // Store slot restrictions
        craftedAt: Date.now()
      };
    }

    // Add to hero's main inventory (simple array) - only if craftedItem exists
    if (craftedItem) {
      hero.inventory.push(craftedItem);
    }

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

    // QUEST TRACKING: Track crafting for quests
    try {
      // Get user's Twitch ID for quest tracking
      const twitchUserId = hero.twitchUserId || hero.twitchId || userId;
      
      // Call quest update endpoint to track crafting
      const questUpdateResponse = await fetch(`${process.env.BACKEND_URL || 'http://localhost:3001'}/api/quests/${twitchUserId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: [{
            trackingKey: 'craft',
            type: 'daily',
            increment: quantity
          }, {
            trackingKey: 'craft',
            type: 'weekly',
            increment: quantity
          }, {
            trackingKey: 'craft',
            type: 'monthly',
            increment: quantity
          }]
        })
      });
      
      if (!questUpdateResponse.ok) {
        console.log(`⚠️ Quest tracking failed (non-critical):`, await questUpdateResponse.text());
      } else {
        console.log(`✅ Quest tracking updated for crafting`);
      }
    } catch (questError) {
      // Non-critical - don't fail the craft if quest tracking fails
      console.log(`⚠️ Quest tracking error (non-critical):`, questError.message);
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
 * Gather materials (ore, herbs, gems)
 * POST /api/professions/:userId/gather
 */
router.post('/:userId/gather', async (req, res) => {
  try {
    const { userId } = req.params;
    
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
    
    // Initialize materials if needed
    if (!profession.materials) {
      if (profession.type === 'herbalism') {
        profession.materials = { herbs: { common: 0, uncommon: 0, rare: 0, epic: 0 } };
      } else if (profession.type === 'mining') {
        profession.materials = {
          ore: { iron: 0, steel: 0, mithril: 0, adamantite: 0 },
          gems: {
            ruby: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
            sapphire: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
            emerald: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
            diamond: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 }
          }
        };
      } else {
        profession.materials = { essence: 0 };
      }
    }
    
    // Cooldown check (5 seconds)
    const now = Date.now();
    const lastGatherTime = profession.lastGatherTime || 0;
    const cooldown = 5000; // 5 seconds
    
    if (now - lastGatherTime < cooldown) {
      const remaining = Math.ceil((cooldown - (now - lastGatherTime)) / 1000);
      return res.status(400).json({ error: `Please wait ${remaining} seconds before gathering again` });
    }
    
    const gathered = {};
    
    if (profession.type === 'herbalism') {
      // Herbalism gathering
      const herbRarities = ['common', 'uncommon', 'rare', 'epic'];
      const rarityWeights = [0.6, 0.25, 0.12, 0.03]; // Higher level = better chances (TODO: scale with level)
      let rand = Math.random();
      let rarity = 'common';
      
      for (let i = 0; i < herbRarities.length; i++) {
        if (rand < rarityWeights.slice(0, i + 1).reduce((a, b) => a + b, 0)) {
          rarity = herbRarities[i];
          break;
        }
      }
      
      profession.materials.herbs[rarity] = (profession.materials.herbs[rarity] || 0) + 1;
      gathered.herbs = { [rarity]: 1 };
    } else if (profession.type === 'mining') {
      // Mining gathering - ore
      const oreTypes = ['iron', 'steel', 'mithril', 'adamantite'];
      const oreWeights = [0.5, 0.3, 0.15, 0.05]; // Higher level = better chances (TODO: scale with level)
      let rand = Math.random();
      let oreType = 'iron';
      
      for (let i = 0; i < oreTypes.length; i++) {
        if (rand < oreWeights.slice(0, i + 1).reduce((a, b) => a + b, 0)) {
          oreType = oreTypes[i];
          break;
        }
      }
      
      profession.materials.ore[oreType] = (profession.materials.ore[oreType] || 0) + 1;
      gathered.ore = { [oreType]: 1 };
      
      // 5% chance to also find a gem
      if (Math.random() < 0.05) {
        const gemTypes = ['ruby', 'sapphire', 'emerald', 'diamond'];
        const gemType = gemTypes[Math.floor(Math.random() * gemTypes.length)];
        
        // Gem rarity based on mining level
        let rarityWeights;
        if (profession.level <= 25) {
          rarityWeights = [0.70, 0.25, 0.05, 0, 0]; // Common, Uncommon, Rare
        } else if (profession.level <= 50) {
          rarityWeights = [0.50, 0.30, 0.15, 0.05, 0]; // + Epic
        } else if (profession.level <= 75) {
          rarityWeights = [0.30, 0.35, 0.25, 0.08, 0.02]; // + Legendary
        } else {
          rarityWeights = [0.20, 0.30, 0.30, 0.15, 0.05]; // Higher Legendary
        }
        
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
        rand = Math.random();
        let gemRarity = 'common';
        
        for (let i = 0; i < rarities.length; i++) {
          if (rand < rarityWeights.slice(0, i + 1).reduce((a, b) => a + b, 0)) {
            gemRarity = rarities[i];
            break;
          }
        }
        
        // Add to materials (for tracking)
        profession.materials.gems[gemType][gemRarity] = (profession.materials.gems[gemType][gemRarity] || 0) + 1;
        gathered.gems = { [gemType]: { [gemRarity]: 1 } };
        
        // Create gem item and add to inventory (stack up to 10)
        const heroInventory = hero.inventory || [];
        const gemStats = generateGemStats(gemType, gemRarity);
        
        // Check if gem of same type and rarity already exists
        const existingGem = heroInventory.find(item => 
          item.type === gemType && 
          item.rarity === gemRarity &&
          !item.slot // Gems don't have a slot (they're consumables)
        );
        
        if (existingGem && (existingGem.quantity || 1) < 10) {
          // Stack with existing gem
          const currentQuantity = existingGem.quantity || 1;
          existingGem.quantity = Math.min(currentQuantity + 1, 10);
        } else {
          // Create new gem item
          const gemItem = {
            id: `gem_${gemType}_${gemRarity}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${gemType.charAt(0).toUpperCase() + gemType.slice(1)} (${gemRarity})`,
            type: gemType,
            rarity: gemRarity,
            slot: 'consumable',
            attack: 0,
            defense: 0,
            hp: 0,
            color: gemType === 'ruby' ? '#ef4444' : gemType === 'sapphire' ? '#3b82f6' : gemType === 'emerald' ? '#10b981' : '#fbbf24',
            stats: gemStats,
            quantity: 1
          };
          
          heroInventory.push(gemItem);
        }
        
        hero.inventory = heroInventory;
      }
    } else if (profession.type === 'enchanting') {
      // Enchanting gathering (essence from combat)
      // Enchanting doesn't gather - essence comes from combat rewards
      return res.status(400).json({ error: 'Enchanting profession does not gather materials. Essence is earned from combat.' });
    }
    
    profession.lastGatherTime = now;
    profession.totalGathered = (profession.totalGathered || 0) + 1;
    
    // Award profession XP
    const xpGain = Math.floor(10 + (profession.level * 0.5)); // Scales with level
    profession.xp = (profession.xp || 0) + xpGain;
    
    // Check for level up
    let leveledUp = false;
    while (profession.xp >= profession.maxXp && profession.level < 100) {
      profession.xp -= profession.maxXp;
      profession.level += 1;
      profession.maxXp = Math.floor(profession.maxXp * 1.15);
      leveledUp = true;
    }
    
    const updateData = {
      profession: profession,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Update inventory if gems were added
    if (hero.inventory) {
      updateData.inventory = hero.inventory;
    }
    
    await heroRef.update(updateData);
    
    res.json({
      success: true,
      message: leveledUp 
        ? `Gathered materials! 🎉 Profession level up! Now level ${profession.level}!`
        : `Gathered materials! +${xpGain} XP`,
      gathered,
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
    console.error('Error gathering:', error);
    res.status(500).json({ error: 'Failed to gather materials' });
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
    
    // Validate slot compatibility
    if (foundItem.applicableSlots && foundItem.applicableSlots.length > 0) {
      if (!foundItem.applicableSlots.includes(equipmentSlot)) {
        return res.status(400).json({ 
          error: `${foundItem.name} can only be applied to ${foundItem.applicableSlots.join(', ')} slots, not ${equipmentSlot}`,
          applicableSlots: foundItem.applicableSlots
        });
      }
    }
    
    // Check if item already has an enchantment (only one buff per item)
    const enchantedItems = hero.enchantedItems || [];
    const hasEnchantment = enchantedItems.some(ei => ei.itemId === equipment.id && ei.enchantments && ei.enchantments.length > 0);
    
    if (hasEnchantment) {
      return res.status(400).json({ 
        error: 'Item already has an enchantment. Remove it first or use a different item.' 
      });
    }
    
    // Check if item already has this same upgrade (prevent duplicates)
    const existingUpgrades = equipment.appliedUpgrades || [];
    const hasSameUpgrade = existingUpgrades.some(upgrade => 
      upgrade.recipeKey === foundRecipeKey || upgrade.itemId === foundItem.id
    );
    
    if (hasSameUpgrade) {
      return res.status(400).json({ 
        error: `This item already has ${foundItem.name}. Cannot apply the same upgrade twice.` 
      });
    }
    
    // Remove old upgrade bonuses if overwriting (only one upgrade per item)
    if (existingUpgrades.length > 0) {
      const oldUpgrade = existingUpgrades[0];
      if (oldUpgrade.bonus) {
        // Subtract old bonuses
        equipment.attack = Math.max(0, (equipment.attack || 0) - (oldUpgrade.bonus.attack || 0));
        equipment.defense = Math.max(0, (equipment.defense || 0) - (oldUpgrade.bonus.defense || 0));
        equipment.hp = Math.max(0, (equipment.hp || 0) - (oldUpgrade.bonus.hp || 0));
      }
      // Clear old upgrades (will be replaced with new one)
      equipment.appliedUpgrades = [];
    }
    
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

    // Track applied upgrade (only one per item)
    equipment.appliedUpgrades = [{
      recipeKey: foundRecipeKey,
      itemId: foundItem.id,
      appliedAt: Date.now(),
      bonus: statBonus
    }];

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
    const { itemKey, itemId } = req.body;
    const { userId } = req.params;

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    const inventory = hero.inventory || [];
    
    // Find the item by itemKey or itemId (support both for flexibility)
    let itemIndex = -1;
    let item = null;
    
    if (itemId) {
      // Try to find by exact ID first
      itemIndex = inventory.findIndex(invItem => invItem.id === itemId);
      
      // If not found, try to find by itemKey match
      if (itemIndex === -1 && itemKey) {
        itemIndex = inventory.findIndex(invItem => 
          invItem.itemKey === itemKey || 
          (invItem.type === 'potion' && itemKey === 'healthpotion') ||
          (invItem.type === 'buff' && (invItem.itemKey === itemKey || invItem.name?.toLowerCase().includes(itemKey.toLowerCase())))
        );
      }
    } else if (itemKey) {
      // First try to find by exact itemKey match
      itemIndex = inventory.findIndex(invItem => invItem.itemKey === itemKey);
      
      // If not found, try by type and name matching
      if (itemIndex === -1) {
        itemIndex = inventory.findIndex(invItem => {
          // Health potion match
          if (itemKey === 'healthpotion' || itemKey === 'health potion') {
            return invItem.type === 'potion' || invItem.itemKey === 'healthpotion' || 
                   (invItem.name && invItem.name.toLowerCase().includes('health potion'));
          }
          // Buff matching
          if (invItem.type === 'buff') {
            return invItem.itemKey === itemKey || 
                   (invItem.name && invItem.name.toLowerCase().includes(itemKey.toLowerCase()));
          }
          return false;
        });
      }
      
      // If itemKey is actually an ID, try that too
      if (itemIndex === -1) {
        itemIndex = inventory.findIndex(invItem => invItem.id === itemKey);
      }
    }
    
    // Log for debugging
    if (itemIndex === -1) {
      console.log(`[Use Item] ❌ Item not found. Searched for itemKey: ${itemKey}, itemId: ${itemId}`);
      console.log(`[Use Item] Available items:`, inventory.map(inv => ({
        id: inv.id,
        itemKey: inv.itemKey,
        type: inv.type,
        name: inv.name
      })));
    }
    
    if (itemIndex === -1) {
      return res.status(404).json({ error: 'Item not found in inventory' });
    }
    
    item = inventory[itemIndex];
    const itemType = item.type || item.itemKey || '';
    
    // Apply effects based on item type
    const updates = {};
    let message = '';
    
    // Health Potion
    if (itemType === 'potion' || item.itemKey === 'healthpotion') {
      const currentHp = hero.hp || 0;
      const maxHp = hero.maxHp || 100;
      const healAmount = Math.floor(maxHp * 0.5); // Heal 50% of max HP
      const newHp = Math.min(maxHp, currentHp + healAmount);
      updates.hp = newHp;
      
      // Overheal converts to shield
      const overheal = healAmount - (newHp - currentHp);
      if (overheal > 0) {
        updates.shield = (hero.shield || 0) + overheal;
      }
      
      message = `Used Health Potion! Restored ${newHp - currentHp} HP${overheal > 0 ? ` (+${overheal} shield)` : ''}`;
    }
    // Buffs (XP Boost, Attack Buff, Defense Buff)
    else if (itemType === 'buff' || item.itemKey) {
      const shopBuffs = hero.shopBuffs || {};
      const now = Date.now();
      
      if (item.itemKey === 'xpboost' || item.name?.toLowerCase().includes('xp boost')) {
        shopBuffs.xpBoost = { remainingDuration: item.duration || 300000, lastUpdateTime: now };
        message = 'Used XP Boost Scroll! +50% XP for 5 minutes';
      } else if (item.itemKey === 'attackbuff' || item.name?.toLowerCase().includes('sharpening')) {
        shopBuffs.attackBuff = { remainingDuration: item.duration || 600000, lastUpdateTime: now };
        message = 'Used Sharpening Stone! +10% ATK for 10 minutes';
      } else if (item.itemKey === 'defensebuff' || item.name?.toLowerCase().includes('armor polish')) {
        shopBuffs.defenseBuff = { remainingDuration: item.duration || 600000, lastUpdateTime: now };
        message = 'Used Armor Polish! +10% DEF for 10 minutes';
      } else {
        return res.status(400).json({ error: 'Unknown buff type' });
      }
      
      updates.shopBuffs = shopBuffs;
    } else {
      return res.status(400).json({ error: 'Unknown item type' });
    }
    
    // Remove item from inventory
    inventory.splice(itemIndex, 1);
    updates.inventory = inventory;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await heroRef.update(updates);
    
    console.log(`🧪 ${userId} used ${item.name || itemKey} (${inventory.length} items remaining in inventory)`);
    console.log(`🧪 Hero HP: ${hero.hp} → ${updates.hp || hero.hp}, Shield: ${hero.shield || 0} → ${updates.shield || hero.shield || 0}`);
    
    res.json({ 
      success: true, 
      message,
      itemUsed: item.name || itemKey,
      newHp: updates.hp || hero.hp,
      newShield: updates.shield || hero.shield || 0,
      inventoryCount: inventory.length
    });
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

    console.log(`⚔️ Equip request: userId=${userId}, slot=${slot}, item.slot=${item?.slot}, item.id=${item?.id}`);

    if (!slot) {
      return res.status(400).json({ error: 'Slot is required' });
    }

    if (!item) {
      return res.status(400).json({ error: 'Item is required' });
    }

    if (!['weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'boots', 'ring1', 'ring2'].includes(slot)) {
      return res.status(400).json({ error: `Invalid equipment slot: ${slot}. Valid slots are: weapon, armor, accessory, shield, helm, cloak, gloves, boots, ring1, ring2` });
    }

    // Validate that item slot matches the target slot (if item has a slot property)
    if (item.slot && item.slot !== slot) {
      console.warn(`⚠️ Item slot (${item.slot}) doesn't match target slot (${slot}), but proceeding anyway`);
    }

    // Validate item has required properties
    if (!item.id) {
      return res.status(400).json({ error: 'Item must have an id property' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    
    // Initialize inventory if it doesn't exist
    if (!hero.inventory) {
      hero.inventory = [];
    }

    // If there's already an item in this slot, add it to inventory (if not already there)
    const equipment = hero.equipment || {};
    const currentItem = equipment[slot];
    if (currentItem) {
      // Check if the current item is already in inventory to prevent duplicates
      const alreadyInInventory = hero.inventory.some(invItem => invItem.id === currentItem.id);
      if (!alreadyInInventory) {
        hero.inventory.push(currentItem);
      }
    }

    // Remove the item from inventory if it's being equipped from inventory
    // Find the item in inventory by ID
    const itemIndex = hero.inventory.findIndex(invItem => invItem.id === item.id);
    if (itemIndex !== -1) {
      hero.inventory.splice(itemIndex, 1);
    }

    // Update equipment and inventory
    await heroRef.update({
      [`equipment.${slot}`]: item,
      inventory: hero.inventory,
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

    if (!['weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'boots', 'ring1', 'ring2'].includes(slot)) {
      return res.status(400).json({ error: 'Invalid equipment slot' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    
    // Initialize inventory if it doesn't exist
    if (!hero.inventory) {
      hero.inventory = [];
    }

    // Get the item from the equipment slot
    const equipment = hero.equipment || {};
    const itemToUnequip = equipment[slot];

    if (!itemToUnequip) {
      return res.status(400).json({ error: 'No item in this slot' });
    }

    // Check if item is already in inventory (to prevent duplicates)
    const alreadyInInventory = hero.inventory.some(invItem => invItem.id === itemToUnequip.id);
    
    // Only add to inventory if it's not already there
    if (!alreadyInInventory) {
      hero.inventory.push(itemToUnequip);
    }

    // Update hero: set equipment slot to null and update inventory
    await heroRef.update({
      [`equipment.${slot}`]: null,
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Item unequipped and added to inventory', item: itemToUnequip });
  } catch (error) {
    console.error('Error unequipping item:', error);
    res.status(500).json({ error: 'Failed to unequip item' });
  }
});

/**
 * Calculate max sockets for an item based on rarity and slot
 */
function getMaxSockets(rarity, slot) {
  const socketRules = {
    // Weapons
    weapon: {
      common: 0,
      uncommon: 0,
      rare: 1,
      epic: 2,
      legendary: 2,
      mythic: 3
    },
    // Armor (Chest)
    armor: {
      common: 0,
      uncommon: 0,
      rare: 1,
      epic: 2,
      legendary: 2,
      mythic: 3
    },
    // Accessories
    accessory: {
      common: 0,
      uncommon: 0,
      rare: 1,
      epic: 1,
      legendary: 2,
      mythic: 2
    },
    // Shield
    shield: {
      common: 0,
      uncommon: 0,
      rare: 1,
      epic: 1,
      legendary: 2,
      mythic: 2
    },
    // Secondary slots (Helm, Cloak, Gloves, Boots, Rings)
    default: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 1,
      legendary: 1,
      mythic: 2
    }
  };
  
  const slotCategory = socketRules[slot] || socketRules.default;
  return slotCategory[rarity] || 0;
}

/**
 * Calculate socket bonuses based on gems in sockets
 */
function calculateSocketBonuses(sockets) {
  if (!sockets || sockets.length === 0) {
    return {};
  }
  
  // Count gems by type
  const gemCounts = {
    ruby: 0,
    sapphire: 0,
    emerald: 0,
    diamond: 0
  };
  
  sockets.forEach(socket => {
    if (socket.gem) {
      gemCounts[socket.gem.type]++;
    }
  });
  
  const bonuses = {};
  const totalGems = gemCounts.ruby + gemCounts.sapphire + gemCounts.emerald + gemCounts.diamond;
  
  // 2-socket bonuses
  if (totalGems >= 2) {
    if (gemCounts.ruby >= 2) {
      bonuses.attack = (bonuses.attack || 0) + 5; // +5% Attack
    }
    if (gemCounts.sapphire >= 2) {
      bonuses.defense = (bonuses.defense || 0) + 5; // +5% Defense
    }
    if (gemCounts.emerald >= 2) {
      bonuses.allStats = (bonuses.allStats || 0) + 3; // +3% All Stats
    }
    if (gemCounts.diamond >= 2) {
      bonuses.xpGain = (bonuses.xpGain || 0) + 10; // +10% XP Gain
    }
    
    // Mixed 2-socket bonuses
    if (gemCounts.ruby === 1 && gemCounts.sapphire === 1) {
      bonuses.attack = (bonuses.attack || 0) + 3;
      bonuses.defense = (bonuses.defense || 0) + 3;
    }
    if (gemCounts.ruby === 1 && gemCounts.emerald === 1) {
      bonuses.attack = (bonuses.attack || 0) + 5;
      bonuses.allStats = (bonuses.allStats || 0) + 2;
    }
    if (gemCounts.sapphire === 1 && gemCounts.emerald === 1) {
      bonuses.defense = (bonuses.defense || 0) + 5;
      bonuses.allStats = (bonuses.allStats || 0) + 2;
    }
    if (gemCounts.ruby === 1 && gemCounts.diamond === 1) {
      bonuses.attack = (bonuses.attack || 0) + 5;
      bonuses.xpGain = (bonuses.xpGain || 0) + 5;
    }
    if (gemCounts.sapphire === 1 && gemCounts.diamond === 1) {
      bonuses.defense = (bonuses.defense || 0) + 5;
      bonuses.xpGain = (bonuses.xpGain || 0) + 5;
    }
    if (gemCounts.emerald === 1 && gemCounts.diamond === 1) {
      bonuses.allStats = (bonuses.allStats || 0) + 3;
      bonuses.xpGain = (bonuses.xpGain || 0) + 5;
    }
  }
  
  // 3-socket bonuses (Mythic gear only)
  if (totalGems >= 3) {
    if (gemCounts.ruby >= 3) {
      bonuses.attack = (bonuses.attack || 0) + 10; // +10% Attack (total)
      bonuses.critChance = (bonuses.critChance || 0) + 5; // +5% Crit Chance
    }
    if (gemCounts.sapphire >= 3) {
      bonuses.defense = (bonuses.defense || 0) + 10; // +10% Defense (total)
      bonuses.damageReduction = (bonuses.damageReduction || 0) + 5; // +5% Damage Reduction
    }
    if (gemCounts.emerald >= 3) {
      bonuses.allStats = (bonuses.allStats || 0) + 8; // +8% All Stats (total)
    }
    if (gemCounts.diamond >= 3) {
      bonuses.xpGain = (bonuses.xpGain || 0) + 20; // +20% XP Gain (total)
      bonuses.goldGain = (bonuses.goldGain || 0) + 10; // +10% Gold Gain
    }
    
    // Mixed 3-socket bonuses
    if (gemCounts.ruby === 2 && gemCounts.sapphire === 1) {
      bonuses.attack = (bonuses.attack || 0) + 8;
      bonuses.defense = (bonuses.defense || 0) + 5;
    }
    if (gemCounts.sapphire === 2 && gemCounts.ruby === 1) {
      bonuses.defense = (bonuses.defense || 0) + 8;
      bonuses.attack = (bonuses.attack || 0) + 5;
    }
    if (gemCounts.ruby === 2 && gemCounts.emerald === 1) {
      bonuses.attack = (bonuses.attack || 0) + 10;
      bonuses.allStats = (bonuses.allStats || 0) + 3;
    }
    if (gemCounts.sapphire === 2 && gemCounts.emerald === 1) {
      bonuses.defense = (bonuses.defense || 0) + 10;
      bonuses.allStats = (bonuses.allStats || 0) + 3;
    }
    if (gemCounts.ruby === 1 && gemCounts.sapphire === 1 && gemCounts.emerald === 1) {
      bonuses.attack = (bonuses.attack || 0) + 5;
      bonuses.defense = (bonuses.defense || 0) + 5;
      bonuses.allStats = (bonuses.allStats || 0) + 5;
    }
    
    // Any gem + Diamond bonus
    if (gemCounts.diamond > 0 && totalGems >= 3) {
      bonuses.xpGain = (bonuses.xpGain || 0) + 10; // Additional +10% XP Gain
    }
  }
  
  return bonuses;
}

/**
 * Apply socket item to gear
 * POST /api/professions/:userId/apply-socket
 */
router.post('/:userId/apply-socket', async (req, res) => {
  try {
    const { heroId, itemId, socketItemId, slot } = req.body;
    const { userId } = req.params;
    
    console.log(`⚙️ Apply socket request: userId=${userId}, heroId=${heroId}, itemId=${itemId}, socketItemId=${socketItemId}, slot=${slot}`);
    
    // Find hero by heroId (Firestore document ID) or userId
    let heroDoc = await db.collection('heroes').doc(heroId || userId).get();
    
    if (!heroDoc.exists) {
      // Try finding by userId field
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroDoc = heroesSnapshot.docs[0];
      } else {
        return res.status(404).json({ error: 'Hero not found' });
      }
    }
    
    const heroRef = heroDoc.ref;
    const hero = heroDoc.data();
    
    if (!hero.inventory) {
      return res.status(400).json({ error: 'Hero inventory not initialized' });
    }
    
    // Find socket item in inventory
    const socketItemIndex = hero.inventory.findIndex(item => item.id === socketItemId);
    if (socketItemIndex === -1) {
      return res.status(400).json({ error: 'Socket item not found in inventory' });
    }
    
    const socketItem = hero.inventory[socketItemIndex];
    // Accept socket items either from crafting (recipeKey + professionType) or direct creation (type)
    const isSocketItem = (socketItem.type === 'socket') || 
                         (socketItem.recipeKey === 'gem_socket' && socketItem.professionType === 'mining');
    if (!isSocketItem) {
      return res.status(400).json({ error: 'Item is not a socket item' });
    }
    
    // Find target item (in equipment or inventory)
    let targetItem = null;
    let targetLocation = null;
    let targetIndex = -1;
    
    // Check equipment first
    const equipment = hero.equipment || {};
    if (slot && equipment[slot] && equipment[slot].id === itemId) {
      targetItem = equipment[slot];
      targetLocation = 'equipment';
    } else {
      // Check inventory
      targetIndex = hero.inventory.findIndex(item => item.id === itemId);
      if (targetIndex !== -1) {
        targetItem = hero.inventory[targetIndex];
        targetLocation = 'inventory';
      }
    }
    
    if (!targetItem) {
      return res.status(400).json({ error: 'Target item not found' });
    }
    
    // Check if item has a slot property (gear items)
    if (!targetItem.slot) {
      return res.status(400).json({ error: 'Cannot add sockets to non-gear items' });
    }
    
    // Calculate max sockets
    const maxSockets = getMaxSockets(targetItem.rarity || 'common', targetItem.slot);
    const currentSockets = targetItem.sockets || [];
    
    if (currentSockets.length >= maxSockets) {
      return res.status(400).json({ error: `Item already has maximum sockets (${maxSockets})` });
    }
    
    // Initialize sockets array if needed
    if (!targetItem.sockets) {
      targetItem.sockets = [];
    }
    
    // Add new socket
    const newSocket = {
      id: `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      // gem field will be added when a gem is inserted, don't include it as undefined
    };
    
    targetItem.sockets.push(newSocket);
    targetItem.maxSockets = maxSockets;
    
    // Remove socket item from inventory (handle quantity)
    const socketQuantity = socketItem.quantity || 1;
    if (socketQuantity > 1) {
      // Decrement quantity
      socketItem.quantity = socketQuantity - 1;
    } else {
      // Remove item if quantity is 1
      hero.inventory.splice(socketItemIndex, 1);
    }
    
    // Update target item
    const updateData = {
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (targetLocation === 'equipment') {
      updateData[`equipment.${slot}`] = targetItem;
    } else {
      // Update in inventory array
      hero.inventory[targetIndex] = targetItem;
      updateData.inventory = hero.inventory;
    }
    
    await heroRef.update(updateData);
    
    res.json({
      success: true,
      message: `Socket added to ${targetItem.name}! (${targetItem.sockets.length}/${maxSockets} sockets)`,
      item: targetItem,
      socketsUsed: targetItem.sockets.length,
      maxSockets: maxSockets
    });
  } catch (error) {
    console.error('Error applying socket:', error);
    res.status(500).json({ error: 'Failed to apply socket' });
  }
});

/**
 * Insert gem into socket
 * POST /api/professions/:userId/gem
 */
router.post('/:userId/gem', async (req, res) => {
  try {
    const { heroId, itemId, socketId, gemId } = req.body;
    const { userId } = req.params;
    
    console.log(`💎 Insert gem request: userId=${userId}, heroId=${heroId}, itemId=${itemId}, socketId=${socketId}, gemId=${gemId}`);
    
    // Find hero
    let heroDoc = await db.collection('heroes').doc(heroId || userId).get();
    
    if (!heroDoc.exists) {
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroDoc = heroesSnapshot.docs[0];
      } else {
        return res.status(404).json({ error: 'Hero not found' });
      }
    }
    
    const heroRef = heroDoc.ref;
    const hero = heroDoc.data();
    
    if (!hero.inventory) {
      return res.status(400).json({ error: 'Hero inventory not initialized' });
    }
    
    // Find gem in inventory
    const gemIndex = hero.inventory.findIndex(item => item.id === gemId);
    if (gemIndex === -1) {
      return res.status(400).json({ error: 'Gem not found in inventory' });
    }
    
    const gemItem = hero.inventory[gemIndex];
    if (!gemItem.type || !['ruby', 'sapphire', 'emerald', 'diamond'].includes(gemItem.type)) {
      return res.status(400).json({ error: 'Item is not a gem' });
    }
    
    // Find target item
    let targetItem = null;
    let targetLocation = null;
    let targetIndex = -1;
    
    // Check equipment
    const equipment = hero.equipment || {};
    for (const [slot, item] of Object.entries(equipment)) {
      if (item && item.id === itemId) {
        targetItem = item;
        targetLocation = 'equipment';
        break;
      }
    }
    
    // Check inventory
    if (!targetItem) {
      targetIndex = hero.inventory.findIndex(item => item.id === itemId);
      if (targetIndex !== -1) {
        targetItem = hero.inventory[targetIndex];
        targetLocation = 'inventory';
      }
    }
    
    if (!targetItem) {
      return res.status(400).json({ error: 'Target item not found' });
    }
    
    if (!targetItem.sockets || targetItem.sockets.length === 0) {
      return res.status(400).json({ error: 'Item has no sockets' });
    }
    
    // Find socket
    const socketIndex = targetItem.sockets.findIndex(s => s.id === socketId);
    if (socketIndex === -1) {
      return res.status(400).json({ error: 'Socket not found' });
    }
    
    const socket = targetItem.sockets[socketIndex];
    if (socket.gem) {
      return res.status(400).json({ error: 'Socket already has a gem' });
    }
    
    // Create gem object from gem item
    const gem = {
      id: gemItem.id,
      type: gemItem.type,
      rarity: gemItem.rarity || 'common',
      stats: gemItem.stats || {}
    };
    
    // Insert gem into socket
    socket.gem = gem;
    
    // Remove gem from inventory (handle quantity)
    const gemQuantity = gemItem.quantity || 1;
    if (gemQuantity > 1) {
      // Decrement quantity
      gemItem.quantity = gemQuantity - 1;
    } else {
      // Remove item if quantity is 1
      hero.inventory.splice(gemIndex, 1);
    }
    
    // Calculate socket bonuses
    const socketBonuses = calculateSocketBonuses(targetItem.sockets);
    targetItem.socketBonuses = socketBonuses;
    
    // Update target item
    const updateData = {
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Find equipment slot if in equipment
    if (targetLocation === 'equipment') {
      for (const [slot, item] of Object.entries(equipment)) {
        if (item && item.id === itemId) {
          updateData[`equipment.${slot}`] = targetItem;
          break;
        }
      }
    } else {
      hero.inventory[targetIndex] = targetItem;
      updateData.inventory = hero.inventory;
    }
    
    await heroRef.update(updateData);
    
    res.json({
      success: true,
      message: `${gemItem.name} inserted into socket!`,
      item: targetItem,
      socketBonuses
    });
  } catch (error) {
    console.error('Error inserting gem:', error);
    res.status(500).json({ error: 'Failed to insert gem' });
  }
});

/**
 * Remove gem from socket
 * POST /api/professions/:userId/remove-gem
 */
router.post('/:userId/remove-gem', async (req, res) => {
  try {
    const { heroId, itemId, socketId } = req.body;
    const { userId } = req.params;
    
    console.log(`💎 Remove gem request: userId=${userId}, heroId=${heroId}, itemId=${itemId}, socketId=${socketId}`);
    
    // Find hero
    let heroDoc = await db.collection('heroes').doc(heroId || userId).get();
    
    if (!heroDoc.exists) {
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroDoc = heroesSnapshot.docs[0];
      } else {
        return res.status(404).json({ error: 'Hero not found' });
      }
    }
    
    const heroRef = heroDoc.ref;
    const hero = heroDoc.data();
    
    if (!hero.inventory) {
      return res.status(400).json({ error: 'Hero inventory not initialized' });
    }
    
    // Find target item
    let targetItem = null;
    let targetLocation = null;
    let targetIndex = -1;
    
    // Check equipment
    const equipment = hero.equipment || {};
    for (const [slot, item] of Object.entries(equipment)) {
      if (item && item.id === itemId) {
        targetItem = item;
        targetLocation = 'equipment';
        break;
      }
    }
    
    // Check inventory
    if (!targetItem) {
      targetIndex = hero.inventory.findIndex(item => item.id === itemId);
      if (targetIndex !== -1) {
        targetItem = hero.inventory[targetIndex];
        targetLocation = 'inventory';
      }
    }
    
    if (!targetItem) {
      return res.status(400).json({ error: 'Target item not found' });
    }
    
    if (!targetItem.sockets || targetItem.sockets.length === 0) {
      return res.status(400).json({ error: 'Item has no sockets' });
    }
    
    // Find socket
    const socketIndex = targetItem.sockets.findIndex(s => s.id === socketId);
    if (socketIndex === -1) {
      return res.status(400).json({ error: 'Socket not found' });
    }
    
    const socket = targetItem.sockets[socketIndex];
    if (!socket.gem) {
      return res.status(400).json({ error: 'Socket is empty' });
    }
    
    // Create gem item from socket gem
    const gemItem = {
      id: socket.gem.id,
      name: `${socket.gem.type.charAt(0).toUpperCase() + socket.gem.type.slice(1)} (${socket.gem.rarity})`,
      type: socket.gem.type,
      rarity: socket.gem.rarity,
      stats: socket.gem.stats,
      slot: 'consumable',
      attack: 0,
      defense: 0,
      hp: 0,
      color: socket.gem.type === 'ruby' ? '#ef4444' : socket.gem.type === 'sapphire' ? '#3b82f6' : socket.gem.type === 'emerald' ? '#10b981' : '#fbbf24'
    };
    
    // Return gem to inventory
    hero.inventory.push(gemItem);
    
    // Remove gem from socket
    // Remove gem field from socket (don't set to undefined, delete the field)
    delete socket.gem;
    
    // Recalculate socket bonuses
    const socketBonuses = calculateSocketBonuses(targetItem.sockets);
    targetItem.socketBonuses = socketBonuses;
    
    // Update target item
    const updateData = {
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Find equipment slot if in equipment
    if (targetLocation === 'equipment') {
      for (const [slot, item] of Object.entries(equipment)) {
        if (item && item.id === itemId) {
          updateData[`equipment.${slot}`] = targetItem;
          break;
        }
      }
    } else {
      hero.inventory[targetIndex] = targetItem;
      updateData.inventory = hero.inventory;
    }
    
    await heroRef.update(updateData);
    
    res.json({
      success: true,
      message: `Gem removed from socket and returned to inventory`,
      item: targetItem,
      gem: gemItem,
      socketBonuses
    });
  } catch (error) {
    console.error('Error removing gem:', error);
    res.status(500).json({ error: 'Failed to remove gem' });
  }
});

export default router;
