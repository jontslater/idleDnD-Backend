// Skills system - 10 skills per class (280 total)
// Skills unlock at levels: 5, 7, 9, 11, 13, 15, 17, 19, 21, 23
// Skill points earned at: 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30

// Skill effect types
export const SKILL_EFFECT_TYPES = {
  STAT_BOOST: 'stat_boost',           // +X% to attack/defense/hp
  DAMAGE_MULTIPLIER: 'damage_mult',   // +X% damage dealt
  HEALING_MULTIPLIER: 'healing_mult',  // +X% healing done
  DEFENSE_MULTIPLIER: 'defense_mult',  // +X% damage reduction
  CRIT_CHANCE: 'crit_chance',         // +X% crit chance
  CRIT_DAMAGE: 'crit_damage',         // +X% crit damage
  COOLDOWN_REDUCTION: 'cooldown_red', // -X% cooldown time
  LIFESTEAL: 'lifesteal',            // +X% lifesteal
  SPEED_BOOST: 'speed_boost',        // +X% attack speed
  RESOURCE_GEN: 'resource_gen'        // +X resource generation
};

// Generate skills for a class
function generateClassSkills(className, displayName, category) {
  const skills = [];
  const unlockLevels = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
  
  // Skill templates by category
  const tankTemplates = [
    { name: 'Fortitude', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'hp', baseValue: 5, description: 'Increases maximum HP' },
    { name: 'Iron Will', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 3, description: 'Reduces damage taken' },
    { name: 'Shield Mastery', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'defense', baseValue: 4, description: 'Increases defense' },
    { name: 'Threat Generation', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'attack', baseValue: 2, description: 'Increases threat generation' },
    { name: 'Last Stand', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 5, description: 'Massive damage reduction at low HP' },
    { name: 'Taunt Mastery', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 10, description: 'Reduces taunt cooldown' },
    { name: 'Armor Expertise', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'defense', baseValue: 6, description: 'Increases armor effectiveness' },
    { name: 'Guardian Stance', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 4, description: 'Party-wide damage reduction' },
    { name: 'Unbreakable', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'hp', baseValue: 8, description: 'Massive HP increase' },
    { name: 'Protector', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 6, description: 'Ultimate tanking skill' }
  ];
  
  const healerTemplates = [
    { name: 'Healing Touch', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 5, description: 'Increases healing done' },
    { name: 'Mana Efficiency', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 8, description: 'Reduces spell cooldowns' },
    { name: 'Divine Grace', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 4, description: 'Increases healing power' },
    { name: 'Rapid Recovery', effect: SKILL_EFFECT_TYPES.SPEED_BOOST, baseValue: 10, description: 'Faster healing casts' },
    { name: 'Group Heal', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 6, description: 'Increases AoE healing' },
    { name: 'Cleanse', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 12, description: 'Faster debuff removal' },
    { name: 'Overheal', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 5, description: 'Overhealing creates shields' },
    { name: 'Resurrection Mastery', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 15, description: 'Faster resurrection' },
    { name: 'Divine Shield', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'defense', baseValue: 3, description: 'Protective aura' },
    { name: 'Master Healer', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 8, description: 'Ultimate healing skill' }
  ];
  
  const dpsTemplates = [
    { name: 'Power Strike', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 5, description: 'Increases damage dealt' },
    { name: 'Critical Hit', effect: SKILL_EFFECT_TYPES.CRIT_CHANCE, baseValue: 3, description: 'Increases crit chance' },
    { name: 'Lethal Blow', effect: SKILL_EFFECT_TYPES.CRIT_DAMAGE, baseValue: 10, description: 'Increases crit damage' },
    { name: 'Combat Mastery', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'attack', baseValue: 4, description: 'Increases attack power' },
    { name: 'Fury', effect: SKILL_EFFECT_TYPES.SPEED_BOOST, baseValue: 8, description: 'Increases attack speed' },
    { name: 'Execution', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 6, description: 'Bonus damage to low HP enemies' },
    { name: 'Precision', effect: SKILL_EFFECT_TYPES.CRIT_CHANCE, baseValue: 5, description: 'Higher crit chance' },
    { name: 'Berserker Rage', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 7, description: 'Massive damage increase' },
    { name: 'Bloodlust', effect: SKILL_EFFECT_TYPES.LIFESTEAL, baseValue: 5, description: 'Lifesteal on damage' },
    { name: 'Master Assassin', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 10, description: 'Ultimate DPS skill' }
  ];
  
  const templates = category === 'tank' ? tankTemplates : 
                    category === 'healer' ? healerTemplates : 
                    dpsTemplates;
  
  unlockLevels.forEach((level, index) => {
    const template = templates[index];
    skills.push({
      id: `${className}_skill_${index + 1}`,
      name: template.name,
      class: className,
      className: displayName,
      category,
      unlockLevel: level,
      effect: template.effect,
      stat: template.stat || null,
      baseValue: template.baseValue,
      maxPoints: 5,
      description: template.description,
      // Scaling: each point adds baseValue% (so 5 points = 5 * baseValue%)
      scaling: (points) => points * template.baseValue
    });
  });
  
  return skills;
}

// Generate all skills for all classes
export function getAllSkills() {
  const allSkills = [];
  const classes = [
    // Tanks
    { key: 'guardian', name: 'Shield Guardian', cat: 'tank' },
    { key: 'paladin', name: 'Holy Defender', cat: 'tank' },
    { key: 'warden', name: 'Wild Warden', cat: 'tank' },
    { key: 'bloodknight', name: 'Blood Knight', cat: 'tank' },
    { key: 'vanguard', name: 'Agile Vanguard', cat: 'tank' },
    { key: 'brewmaster', name: 'Brewed Monk', cat: 'tank' },
    // Healers
    { key: 'cleric', name: 'Cleric', cat: 'healer' },
    { key: 'atoner', name: 'Atoner', cat: 'healer' },
    { key: 'druid', name: 'Restoration Druid', cat: 'healer' },
    { key: 'lightbringer', name: 'Lightbringer', cat: 'healer' },
    { key: 'shaman', name: 'Spirit Healer', cat: 'healer' },
    { key: 'mistweaver', name: 'Mistweaver', cat: 'healer' },
    { key: 'chronomancer', name: 'Chronomender', cat: 'healer' },
    { key: 'bard', name: 'Bard', cat: 'healer' },
    // DPS
    { key: 'berserker', name: 'Berserker', cat: 'dps' },
    { key: 'crusader', name: 'Crusader', cat: 'dps' },
    { key: 'assassin', name: 'Assassin', cat: 'dps' },
    { key: 'reaper', name: 'Reaper', cat: 'dps' },
    { key: 'bladedancer', name: 'Blade Dancer', cat: 'dps' },
    { key: 'monk', name: 'Chi Fighter', cat: 'dps' },
    { key: 'stormwarrior', name: 'Storm Warrior', cat: 'dps' },
    { key: 'hunter', name: 'Beast Stalker', cat: 'dps' },
    { key: 'mage', name: 'Elementalist', cat: 'dps' },
    { key: 'warlock', name: 'Warlock', cat: 'dps' },
    { key: 'ranger', name: 'Marksman', cat: 'dps' },
    { key: 'shadowpriest', name: 'Dark Oracle', cat: 'dps' },
    { key: 'mooncaller', name: 'Mooncaller', cat: 'dps' },
    { key: 'stormcaller', name: 'Stormcaller', cat: 'dps' },
    { key: 'dragonsorcerer', name: 'Draconic Sorcerer', cat: 'dps' }
  ];
  
  classes.forEach(cls => {
    const classSkills = generateClassSkills(cls.key, cls.name, cls.cat);
    allSkills.push(...classSkills);
  });
  
  return allSkills;
}

// Get skills for a specific class
export function getSkillsForClass(className) {
  return getAllSkills().filter(skill => skill.class === className);
}

// Get skill by ID
export function getSkillById(skillId) {
  return getAllSkills().find(skill => skill.id === skillId);
}

export const MAX_HERO_LEVEL_FOR_SKILLS = 100;
/** First level that awards a skill point (6), then +1 every 2 levels through 100. */
export const FIRST_SKILL_POINT_LEVEL = 6;
export const SKILL_POINT_LEVEL_STEP = 2;

/** Total skill points earned from level 1 through `level` (ignores spent points). */
export function calculateSkillPoints(level) {
  if (level < FIRST_SKILL_POINT_LEVEL) return 0;

  const capped = Math.min(level, MAX_HERO_LEVEL_FOR_SKILLS);
  let count = 0;
  for (let l = FIRST_SKILL_POINT_LEVEL; l <= capped; l += SKILL_POINT_LEVEL_STEP) {
    count++;
  }
  return count;
}

export function skillPointsSpentInTree(skills) {
  if (!skills) return 0;
  return Object.values(skills).reduce((sum, skill) => sum + (skill.points || 0), 0);
}

/**
 * Server-authoritative skill point fields from hero level and allocated skills.
 * Client-provided skillPoints / skillPointsEarned are ignored when persisting heroes.
 */
export function resolveSkillPointFields(level, skills) {
  const skillPointsEarned = calculateSkillPoints(level);
  const spent = skillPointsSpentInTree(skills);
  return {
    skillPoints: Math.max(0, skillPointsEarned - spent),
    skillPointsEarned
  };
}

// Get available skills for a hero (unlocked based on level)
export function getAvailableSkills(className, level) {
  const classSkills = getSkillsForClass(className);
  return classSkills.filter(skill => level >= skill.unlockLevel);
}
