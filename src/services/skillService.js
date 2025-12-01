import admin from 'firebase-admin';
import { db } from '../index.js';
import { getAllSkills, getSkillsForClass, getSkillById, calculateSkillPoints } from '../data/skills.js';

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
    
    // Get ALL skills for this class (not just unlocked ones)
    const allClassSkills = getSkillsForClass(hero.role);
    
    // Merge with hero's allocated skills
    const skillsData = allClassSkills.map(skill => ({
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

// Allocate skill point
export async function allocateSkillPoint(userId, skillId) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      throw new Error('Hero not found');
    }
    
    const hero = doc.data();
    const level = hero.level || 1;
    const skillPoints = hero.skillPoints || 0;
    const skills = hero.skills || {};
    
    // Check if hero has skill points
    if (skillPoints < 1) {
      throw new Error('Not enough skill points');
    }
    
    // Get skill definition
    const skillDef = getSkillById(skillId);
    if (!skillDef) {
      throw new Error('Invalid skill ID');
    }
    
    // Check if skill is for this class
    if (skillDef.class !== hero.role) {
      throw new Error('Skill does not belong to hero class');
    }
    
    // Check if skill is unlocked
    if (level < skillDef.unlockLevel) {
      throw new Error(`Skill unlocks at level ${skillDef.unlockLevel}`);
    }
    
    // Check if skill is already maxed
    const currentPoints = skills[skillId]?.points || 0;
    if (currentPoints >= skillDef.maxPoints) {
      throw new Error('Skill is already maxed out');
    }
    
    // Allocate point
    if (!skills[skillId]) {
      skills[skillId] = {
        points: 0,
        unlockedAt: level
      };
    }
    
    skills[skillId].points = currentPoints + 1;
    
    // Update hero
    await heroRef.update({
      skills,
      skillPoints: skillPoints - 1,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      skill: {
        ...skillDef,
        points: skills[skillId].points
      },
      remainingPoints: skillPoints - 1
    };
  } catch (error) {
    console.error('Error allocating skill point:', error);
    throw error;
  }
}

// Reset all skills (costs tokens)
export async function resetSkills(userId, cost = 500) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      throw new Error('Hero not found');
    }
    
    const hero = doc.data();
    const tokens = hero.tokens || 0;
    const level = hero.level || 1;
    
    // Check if hero has enough tokens
    if (tokens < cost) {
      throw new Error(`Not enough tokens. Need ${cost}, have ${tokens}`);
    }
    
    // Calculate skill points to refund
    const skills = hero.skills || {};
    let totalPointsSpent = 0;
    Object.values(skills).forEach(skill => {
      totalPointsSpent += skill.points || 0;
    });
    
    // Reset skills and refund points
    await heroRef.update({
      skills: {},
      skillPoints: totalPointsSpent,
      tokens: tokens - cost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      pointsRefunded: totalPointsSpent,
      tokensRemaining: tokens - cost
    };
  } catch (error) {
    console.error('Error resetting skills:', error);
    throw error;
  }
}

// Calculate skill bonuses for a hero
export function calculateSkillBonuses(hero) {
  const skills = hero.skills || {};
  const bonuses = {
    attack: 0,
    defense: 0,
    hp: 0,
    damageMultiplier: 0,
    healingMultiplier: 0,
    defenseMultiplier: 0,
    critChance: 0,
    critDamage: 0,
    cooldownReduction: 0,
    lifesteal: 0,
    speedBoost: 0
  };
  
  Object.entries(skills).forEach(([skillId, skillData]) => {
    const skillDef = getSkillById(skillId);
    if (!skillDef || !skillData.points) return;
    
    const value = skillDef.scaling(skillData.points);
    
    switch (skillDef.effect) {
      case 'stat_boost':
        if (skillDef.stat === 'attack') bonuses.attack += value;
        else if (skillDef.stat === 'defense') bonuses.defense += value;
        else if (skillDef.stat === 'hp') bonuses.hp += value;
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
    }
  });
  
  return bonuses;
}

// Update skill points when hero levels up
export async function updateSkillPointsOnLevelUp(userId, newLevel) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) return;
    
    const hero = doc.data();
    const oldLevel = hero.level || 1;
    
    // Calculate skill points for both levels
    const oldPoints = calculateSkillPoints(oldLevel);
    const newPoints = calculateSkillPoints(newLevel);
    
    // If new level earns a skill point (every other level past 5)
    if (newPoints > oldPoints) {
      const pointsEarned = newPoints - oldPoints;
      const currentPoints = hero.skillPoints || 0;
      const currentEarned = hero.skillPointsEarned || 0;
      
      await heroRef.update({
        skillPoints: currentPoints + pointsEarned,
        skillPointsEarned: currentEarned + pointsEarned,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error updating skill points on level up:', error);
  }
}
