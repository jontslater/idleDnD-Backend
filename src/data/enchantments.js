// Enchantment definitions with slot restrictions and effects

export const ENCHANTMENT_SLOTS = {
  weapon: ['weapon'],
  armor: ['armor', 'helm', 'cloak', 'gloves', 'boots', 'shield'],
  accessory: ['accessory', 'ring1', 'ring2'],
  all: ['weapon', 'armor', 'accessory', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots', 'shield']
};

export const ENCHANTMENTS = {
  // WEAPON ENCHANTMENTS (affect damage/enemy)
  fiery_weapon: {
    id: 'fiery_weapon',
    name: 'Fiery Weapon',
    description: 'Weapon deals fire damage over time to enemies',
    slot: 'weapon',
    applicableSlots: ENCHANTMENT_SLOTS.weapon,
    effect: 'fire_dot',
    baseValue: 5, // Damage per tick
    maxLevel: 10,
    costPerLevel: 10
  },
  frozen_weapon: {
    id: 'frozen_weapon',
    name: 'Frozen Weapon',
    description: 'Weapon slows enemies on hit',
    slot: 'weapon',
    applicableSlots: ENCHANTMENT_SLOTS.weapon,
    effect: 'slow_enemy',
    baseValue: 10, // Slow percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  lightning_weapon: {
    id: 'lightning_weapon',
    name: 'Lightning Weapon',
    description: 'Weapon has chance to chain lightning to nearby enemies',
    slot: 'weapon',
    applicableSlots: ENCHANTMENT_SLOTS.weapon,
    effect: 'chain_lightning',
    baseValue: 15, // Chain damage percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  poison_weapon: {
    id: 'poison_weapon',
    name: 'Poisoned Weapon',
    description: 'Weapon applies poison debuff to enemies',
    slot: 'weapon',
    applicableSlots: ENCHANTMENT_SLOTS.weapon,
    effect: 'poison_enemy',
    baseValue: 8, // Poison damage per tick
    maxLevel: 10,
    costPerLevel: 10
  },
  lifesteal_weapon: {
    id: 'lifesteal_weapon',
    name: 'Lifesteal Weapon',
    description: 'Weapon heals you for a percentage of damage dealt',
    slot: 'weapon',
    applicableSlots: ENCHANTMENT_SLOTS.weapon,
    effect: 'lifesteal',
    baseValue: 5, // Lifesteal percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  
  // ARMOR ENCHANTMENTS (affect defense/self)
  frozen_armor: {
    id: 'frozen_armor',
    name: 'Frozen Armor',
    description: 'Armor slows attackers when you take damage',
    slot: 'armor',
    applicableSlots: ENCHANTMENT_SLOTS.armor,
    effect: 'thorns_slow',
    baseValue: 20, // Slow percentage applied to attacker
    maxLevel: 10,
    costPerLevel: 10
  },
  thorns_armor: {
    id: 'thorns_armor',
    name: 'Thorns Armor',
    description: 'Armor reflects damage back to attackers',
    slot: 'armor',
    applicableSlots: ENCHANTMENT_SLOTS.armor,
    effect: 'thorns_damage',
    baseValue: 15, // Reflected damage percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  regeneration_armor: {
    id: 'regeneration_armor',
    name: 'Regeneration Armor',
    description: 'Armor provides health regeneration',
    slot: 'armor',
    applicableSlots: ENCHANTMENT_SLOTS.armor,
    effect: 'hp_regen',
    baseValue: 2, // HP per second
    maxLevel: 10,
    costPerLevel: 10
  },
  fortification_armor: {
    id: 'fortification_armor',
    name: 'Fortification Armor',
    description: 'Armor increases defense',
    slot: 'armor',
    applicableSlots: ENCHANTMENT_SLOTS.armor,
    effect: 'defense_boost',
    baseValue: 5, // Defense increase percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  
  // ACCESSORY ENCHANTMENTS (affect stats/buffs)
  power_accessory: {
    id: 'power_accessory',
    name: 'Power Enchantment',
    description: 'Increases attack power',
    slot: 'accessory',
    applicableSlots: ENCHANTMENT_SLOTS.accessory,
    effect: 'attack_boost',
    baseValue: 5, // Attack increase percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  vitality_accessory: {
    id: 'vitality_accessory',
    name: 'Vitality Enchantment',
    description: 'Increases maximum HP',
    slot: 'accessory',
    applicableSlots: ENCHANTMENT_SLOTS.accessory,
    effect: 'hp_boost',
    baseValue: 5, // HP increase percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  haste_accessory: {
    id: 'haste_accessory',
    name: 'Haste Enchantment',
    description: 'Increases attack speed',
    slot: 'accessory',
    applicableSlots: ENCHANTMENT_SLOTS.accessory,
    effect: 'speed_boost',
    baseValue: 5, // Speed increase percentage
    maxLevel: 10,
    costPerLevel: 10
  },
  critical_accessory: {
    id: 'critical_accessory',
    name: 'Critical Strike Enchantment',
    description: 'Increases critical strike chance',
    slot: 'accessory',
    applicableSlots: ENCHANTMENT_SLOTS.accessory,
    effect: 'crit_chance',
    baseValue: 2, // Crit chance percentage
    maxLevel: 10,
    costPerLevel: 10
  }
};

// Get enchantments applicable to a slot
export function getEnchantmentsForSlot(slot) {
  return Object.values(ENCHANTMENTS).filter(ench => 
    ench.applicableSlots.includes(slot)
  );
}

// Get enchantment by ID
export function getEnchantmentById(id) {
  return ENCHANTMENTS[id];
}

// Calculate enchantment effect value based on level
export function calculateEnchantmentValue(enchantmentId, level) {
  const enchantment = ENCHANTMENTS[enchantmentId];
  if (!enchantment) return 0;
  
  return enchantment.baseValue * level;
}
