import admin from 'firebase-admin';
import { db } from '../index.js';
import { ACHIEVEMENTS, getAchievementById } from '../data/achievements.js';

// Check and unlock achievements for a hero
export async function checkAchievements(userId, actionType, actionValue = 1) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return [];
    }
    
    const hero = doc.data();
    const unlockedAchievements = hero.achievements || [];
    const unlockedIds = unlockedAchievements.map(a => a.achievementId);
    
    const newlyUnlocked = [];
    
    // Check each achievement
    for (const achievement of ACHIEVEMENTS) {
      if (unlockedIds.includes(achievement.id)) {
        continue; // Already unlocked
      }
      
      let progress = 0;
      let shouldUnlock = false;
      
      // Calculate progress based on achievement type
      switch (achievement.requirements.type) {
        case 'killCount':
          progress = hero.stats?.totalKills || 0;
          break;
        case 'bossKills':
          progress = hero.stats?.bossKills || 0;
          break;
        case 'totalDamage':
          progress = hero.stats?.totalDamage || 0;
          break;
        case 'totalHealing':
          progress = hero.stats?.totalHealing || 0;
          break;
        case 'level':
          progress = hero.level || 1;
          break;
        case 'gatherCount':
          progress = hero.profession?.totalGathered || 0;
          break;
        case 'craftCount':
          progress = hero.profession?.totalCrafted || 0;
          break;
        case 'guildJoin':
          // Check if hero is in a guild
          const guildSnapshot = await db.collection('guilds')
            .where('memberIds', 'array-contains', userId)
            .limit(1)
            .get();
          progress = guildSnapshot.empty ? 0 : 1;
          break;
        case 'guildLevel':
          const guildSnap = await db.collection('guilds')
            .where('memberIds', 'array-contains', userId)
            .limit(1)
            .get();
          if (!guildSnap.empty) {
            const guild = guildSnap.docs[0].data();
            progress = guild.level || 0;
          }
          break;
        case 'questsCompleted':
          progress = hero.stats?.questsCompleted || 0;
          break;
        case 'skillsUnlocked':
          const skills = hero.skills || {};
          progress = Object.keys(skills).length;
          break;
      }
      
      if (progress >= achievement.requirements.target) {
        shouldUnlock = true;
      }
      
      if (shouldUnlock) {
        // Unlock achievement
        const achievementData = {
          achievementId: achievement.id,
          unlockedAt: admin.firestore.Timestamp.now(),
          progress: achievement.requirements.target
        };
        
        unlockedAchievements.push(achievementData);
        
        // Apply rewards
        const rewards = achievement.rewards || {};
        const updates = {
          achievements: unlockedAchievements,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (rewards.tokens) {
          updates.tokens = (hero.tokens || 0) + rewards.tokens;
        }
        
        if (rewards.gold) {
          updates.gold = (hero.gold || 0) + rewards.gold;
        }
        
        if (rewards.title) {
          const titles = hero.titles || [];
          if (!titles.includes(rewards.title)) {
            titles.push(rewards.title);
            updates.titles = titles;
          }
        }
        
        await heroRef.update(updates);
        
        newlyUnlocked.push({
          achievement,
          rewards
        });
      }
    }
    
    return newlyUnlocked;
  } catch (error) {
    console.error('Error checking achievements:', error);
    return [];
  }
}

// Get hero's achievements
export async function getHeroAchievements(userId) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return null;
    }
    
    const hero = doc.data();
    const achievements = hero.achievements || [];
    const titles = hero.titles || [];
    const activeTitle = hero.activeTitle || null;
    
    // Enrich with achievement data
    const enrichedAchievements = achievements.map(a => {
      const achievementDef = getAchievementById(a.achievementId);
      return {
        ...a,
        achievement: achievementDef
      };
    });
    
    return {
      achievements: enrichedAchievements,
      titles,
      activeTitle
    };
  } catch (error) {
    console.error('Error getting hero achievements:', error);
    throw error;
  }
}

// Set active title
export async function setActiveTitle(userId, title) {
  try {
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      throw new Error('Hero not found');
    }
    
    const hero = doc.data();
    const titles = hero.titles || [];
    
    if (!titles.includes(title)) {
      throw new Error('Title not unlocked');
    }
    
    await heroRef.update({
      activeTitle: title,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true, activeTitle: title };
  } catch (error) {
    console.error('Error setting active title:', error);
    throw error;
  }
}
