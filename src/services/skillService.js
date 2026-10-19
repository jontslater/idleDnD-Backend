import admin from 'firebase-admin';
import { db } from '../index.js';
import {
  getAllSkills,
  getSkillsForClass,
  getSkillById,
  calculateSkillPoints,
  sumSkillRanks,
  MAX_SKILL_RANK
} from '../data/skills.js';
import { SKILL_BALANCE_CAPS } from '../data/skillDefinitions.js';

/** Server-fixed respec cost (client cannot override). */
export const DEFAULT_PLAYER_RESPEC_GOLD_COST = 250;

function runTx(updateFn) {
  if (typeof db.runTransaction === 'function') {
    return db.runTransaction(updateFn);
  }
  return updateFn({
    async get(ref) {
      return ref.get();
    },
    update(ref, data) {
      return ref.update(data);
    }
  });
}

export function totalPointsSpent(skills) {
  return sumSkillRanks(skills);
}

export function expectedSkillPointsEarned(hero) {
  const level = hero.level || 1;
  const fromLevel = calculateSkillPoints(level);
  const tracked = hero.skillPointsEarned;
  if (tracked != null && tracked > fromLevel) {
    return tracked;
  }
  return fromLevel;
}

// Get hero's skills
export async function getHeroSkills(userId) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return null;
    }

    const hero = doc.data();
    const skills = hero.skills || {};
    const skillPoints = hero.skillPoints || 0;
    const skillPointsEarned = hero.skillPointsEarned || 0;
    const level = hero.level || 1;

    const allClassSkills = getSkillsForClass(hero.role);

    const skillsData = allClassSkills.map((skill) => ({
      ...skill,
      points: skills[skill.id]?.points || 0,
      unlockedAt: skills[skill.id]?.unlockedAt || null
    }));

    return {
      skills: skillsData,
      skillPoints,
      skillPointsEarned,
      totalSkillPoints: calculateSkillPoints(level),
      level
    };
  } catch (error) {
    console.error('Error getting hero skills:', error);
    throw error;
  }
}

function validateSkillAllocation(hero, skillId, skills) {
  const level = hero.level || 1;
  const skillPoints = hero.skillPoints || 0;
  if (skillPoints < 1) {
    throw new Error('Not enough skill points');
  }

  const skillDef = getSkillById(skillId);
  if (!skillDef) {
    throw new Error('Invalid skill ID');
  }

  if (skillDef.class !== hero.role) {
    throw new Error('Skill does not belong to hero class');
  }

  if (level < skillDef.unlockLevel) {
    throw new Error(`Skill unlocks at level ${skillDef.unlockLevel}`);
  }

  const currentPoints = skills[skillId]?.points || 0;
  if (currentPoints >= MAX_SKILL_RANK || currentPoints >= skillDef.maxPoints) {
    throw new Error('Skill is already maxed out');
  }

  const earned = expectedSkillPointsEarned(hero);
  const spent = totalPointsSpent(skills);
  if (spent + 1 > earned) {
    throw new Error('Cannot spend more points than earned');
  }

  return { skillDef, currentPoints };
}

// Allocate skill point (transactional)
export async function allocateSkillPoint(userId, skillId) {
  const heroRef = db.collection('heroes').doc(userId);

  return runTx(async (tx) => {
    const doc = await tx.get(heroRef);
    if (!doc.exists) {
      throw new Error('Hero not found');
    }

    const hero = doc.data();
    const skills = { ...(hero.skills || {}) };
    const { skillDef, currentPoints } = validateSkillAllocation(hero, skillId, skills);

    if (!skills[skillId]) {
      skills[skillId] = {
        points: 0,
        unlockedAt: hero.level || 1
      };
    }

    skills[skillId].points = currentPoints + 1;
    const skillPoints = (hero.skillPoints || 0) - 1;

    await tx.update(heroRef, {
      skills,
      skillPoints,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      skill: {
        ...skillDef,
        points: skills[skillId].points
      },
      remainingPoints: skillPoints
    };
  });
}

async function resetSkillsCore(userId, { goldCost = 0, tokenCost = 0, useTokens = false } = {}) {
  const heroRef = db.collection('heroes').doc(userId);

  return runTx(async (tx) => {
    const doc = await tx.get(heroRef);
    if (!doc.exists) {
      throw new Error('Hero not found');
    }

    const hero = doc.data();
    const level = hero.level || 1;
    const totalEarned = expectedSkillPointsEarned(hero);
    const targetEarned = Math.max(totalEarned, calculateSkillPoints(level));

    if (useTokens) {
      const tokens = hero.tokens || 0;
      if (tokens < tokenCost) {
        throw new Error(`Not enough tokens. Need ${tokenCost}, have ${tokens}`);
      }
    } else if (goldCost > 0) {
      const gold = hero.gold || 0;
      if (gold < goldCost) {
        throw new Error(`Not enough gold. Need ${goldCost}, have ${gold}`);
      }
    }

    const spent = totalPointsSpent(hero.skills || {});
    const updates = {
      skills: {},
      skillPoints: targetEarned,
      skillPointsEarned: targetEarned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (useTokens && tokenCost > 0) {
      updates.tokens = (hero.tokens || 0) - tokenCost;
    } else if (goldCost > 0) {
      updates.gold = (hero.gold || 0) - goldCost;
    }

    await tx.update(heroRef, updates);

    return {
      success: true,
      pointsRefunded: spent,
      skillPointsAvailable: targetEarned,
      pointsSpentBeforeReset: spent,
      tokensRemaining: useTokens ? updates.tokens : hero.tokens,
      goldRemaining: updates.gold ?? hero.gold
    };
  });
}

/** Player respec — refunds all points (unspent + spent = earned). */
export async function respecSkillsForPlayer(userId) {
  return resetSkillsCore(userId, { goldCost: DEFAULT_PLAYER_RESPEC_GOLD_COST, useTokens: false });
}

/** Admin reset — no premium token spend (cosmetic-only policy). */
export async function resetSkills(userId, _cost = 500) {
  return resetSkillsCore(userId, { goldCost: 0, useTokens: false });
}

// Calculate skill bonuses for a hero (capped)
export function calculateSkillBonuses(hero) {
  const skills = hero.skills || {};
  const bonuses = {
    attack: 0,
    defense: 0,
    hpPercentMax: 0,
    damageMultiplier: 0,
    healingMultiplier: 0,
    defenseMultiplier: 0,
    critChance: 0,
    critDamage: 0,
    cooldownReduction: 0,
    lifesteal: 0,
    speedBoost: 0,
    doubleHealProcChance: 0
  };

  Object.entries(skills).forEach(([skillId, skillData]) => {
    const skillDef = getSkillById(skillId);
    if (!skillDef || !skillData.points) return;

    const value = skillDef.scaling(skillData.points);

    switch (skillDef.effect) {
      case 'stat_boost':
        if (skillDef.stat === 'attack') bonuses.attack += value;
        else if (skillDef.stat === 'defense') bonuses.defense += value;
        break;
      case 'hp_percent_max':
        bonuses.hpPercentMax += value;
        break;
      case 'damage_mult':
        bonuses.damageMultiplier += value;
        break;
      case 'healing_mult':
        bonuses.healingMultiplier += value;
        break;
      case 'defense_mult':
        bonuses.defenseMultiplier += value;
        break;
      case 'crit_chance':
        bonuses.critChance += value;
        break;
      case 'crit_damage':
        bonuses.critDamage += value;
        break;
      case 'cooldown_red':
        bonuses.cooldownReduction += value;
        break;
      case 'lifesteal':
        bonuses.lifesteal += value;
        break;
      case 'speed_boost':
        bonuses.speedBoost += value;
        break;
      case 'double_heal_proc':
        bonuses.doubleHealProcChance += value;
        break;
      default:
        break;
    }
  });

  bonuses.critChance = Math.min(bonuses.critChance, SKILL_BALANCE_CAPS.critChancePercent);
  bonuses.defenseMultiplier = Math.min(
    bonuses.defenseMultiplier,
    SKILL_BALANCE_CAPS.damageReductionPercent
  );
  bonuses.cooldownReduction = Math.min(
    bonuses.cooldownReduction,
    SKILL_BALANCE_CAPS.cooldownReductionPercent
  );

  return bonuses;
}

// Legacy: level-up points should be applied via levelUpHelper patch; kept for direct calls.
export async function updateSkillPointsOnLevelUp(userId, newLevel) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    if (!doc.exists) return;

    const hero = doc.data();
    const { skillPointPatchForLevelUp } = await import('../utils/levelUpHelper.js');
    const patch = skillPointPatchForLevelUp(hero, newLevel);
    if (Object.keys(patch).length === 0) return;

    await heroRef.update({
      ...patch,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating skill points on level up:', error);
  }
}
