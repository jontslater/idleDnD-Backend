/**
 * Inventory Validator
 * Centralized validation for inventory space before adding items
 * Prevents inventory overflow (e.g., 61/50 slots)
 */

/**
 * Validates if there's enough inventory space for items to be added
 * Uses the same slot counting logic as heroes.js
 * 
 * @param {Object} hero - Hero object with inventory and bankSize
 * @param {Array} itemsToAdd - Array of items to be added to inventory
 * @returns {Object} Validation result with valid flag and details
 */
export function validateInventorySpace(hero, itemsToAdd) {
  const currentInventory = hero.inventory || [];
  const maxSlots = hero.bankSize || 50;
  
  // Count current slots (same logic as heroes.js)
  // Group consumables by itemKey, profession items by recipeKey/id
  const consumableGroups = new Set();
  const professionGroups = new Set();
  let regularItemCount = 0;
  
  currentInventory.forEach(item => {
    if (item.professionItem) {
      const key = item.recipeKey || item.id;
      professionGroups.add(key);
    } else if (item.type === 'potion' || item.type === 'buff' || item.itemKey) {
      const key = item.itemKey || item.name || item.id;
      consumableGroups.add(key);
    } else {
      regularItemCount++;
    }
  });
  
  const currentSlotsUsed = professionGroups.size + consumableGroups.size + regularItemCount;
  
  // Count new items that need slots
  let newSlotsNeeded = 0;
  const newConsumableGroups = new Set(consumableGroups);
  const newProfessionGroups = new Set(professionGroups);
  let newRegularItemCount = regularItemCount;
  
  itemsToAdd.forEach(item => {
    if (item.professionItem) {
      const key = item.recipeKey || item.id;
      if (!newProfessionGroups.has(key)) {
        newSlotsNeeded++;
        newProfessionGroups.add(key);
      }
    } else if (item.type === 'potion' || item.type === 'buff' || item.itemKey) {
      const key = item.itemKey || item.name || item.id;
      if (!newConsumableGroups.has(key)) {
        newSlotsNeeded++;
        newConsumableGroups.add(key);
      }
    } else {
      // Regular gear items always take a slot
      newSlotsNeeded++;
      newRegularItemCount++;
    }
  });
  
  const totalSlotsNeeded = currentSlotsUsed + newSlotsNeeded;
  
  if (totalSlotsNeeded > maxSlots) {
    return {
      valid: false,
      currentSlots: currentSlotsUsed,
      maxSlots: maxSlots,
      needed: newSlotsNeeded,
      totalNeeded: totalSlotsNeeded,
      error: `Inventory full! You have ${currentSlotsUsed}/${maxSlots} slots used. Cannot add ${newSlotsNeeded} more item(s). Sell items or expand storage.`
    };
  }
  
  return {
    valid: true,
    currentSlots: currentSlotsUsed,
    maxSlots: maxSlots,
    needed: newSlotsNeeded,
    totalNeeded: totalSlotsNeeded
  };
}

/**
 * Validates inventory space for a single item
 * Convenience wrapper around validateInventorySpace
 * 
 * @param {Object} hero - Hero object
 * @param {Object} item - Single item to add
 * @returns {Object} Validation result
 */
export function validateSingleItem(hero, item) {
  return validateInventorySpace(hero, [item]);
}



