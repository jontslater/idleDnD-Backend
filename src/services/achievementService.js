import admin from 'firebase-admin';
const db = admin.firestore();

/**
 * Track achievement progress
 * @param {string} heroId - Hero document ID
 * @param {string} trackingKey - Achievement tracking key (e.g., 'enemies_defeated')
 * @param {number} incrementOrValue - Amount to increment by, or new value for 'single' type
 */
async function trackAchievement(heroId, trackingKey, incrementOrValue = 1) {
  if (!heroId || !trackingKey) {
    console.error('[Achievement] Missing heroId or trackingKey');
    return;
  }

  try {
    const heroRef = db.collection('heroes').doc(heroId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      console.error(`[Achievement] Hero ${heroId} not found`);
      return;
    }

    const hero = heroDoc.data();
    
    // Get all achievements that use this tracking key
    const achievementsSnapshot = await db.collection('achievements')
      .where('trackingKey', '==', trackingKey)
      .get();
    
    if (achievementsSnapshot.empty) {
      // No achievements track this key yet
      return;
    }

    const updates = {};
    const newlyCompleted = [];
    
    achievementsSnapshot.forEach(doc => {
      const achievement = doc.data();
      const achievementId = doc.id;
      const progress = hero.achievements?.progress?.[achievementId];
      const currentValue = progress?.current || 0;
      const isCompleted = progress?.completed || false;
      
      // Skip if already completed
      if (isCompleted) return;
      
      let newValue;
      if (achievement.requirement.type === 'single') {
        // For 'single' type, set the value directly (e.g., highest damage, current gold)
        newValue = incrementOrValue;
      } else {
        // For 'count' type, increment the value
        newValue = currentValue + incrementOrValue;
      }
      
      // Update progress
      updates[`achievements.progress.${achievementId}.current`] = newValue;
      
      // Check if achievement is now completed
      if (newValue >= achievement.requirement.count) {
        newlyCompleted.push({ id: achievementId, data: achievement });
      }
    });
    
    // Apply progress updates
    if (Object.keys(updates).length > 0) {
      await heroRef.update(updates);
    }
    
    // Award newly completed achievements
    for (const achievement of newlyCompleted) {
      await awardAchievement(heroId, achievement.id, achievement.data, hero);
    }
    
  } catch (error) {
    console.error(`[Achievement] Error tracking ${trackingKey} for ${heroId}:`, error);
  }
}

/**
 * Award achievement rewards
 */
async function awardAchievement(heroId, achievementId, achievement, hero) {
  try {
    const heroRef = db.collection('heroes').doc(heroId);
    
    console.log(`[Achievement] 🏆 ${hero.name} unlocked: ${achievement.name}`);
    
    await heroRef.update({
      [`achievements.completed`]: admin.firestore.FieldValue.arrayUnion(achievementId),
      [`achievements.progress.${achievementId}.completed`]: true,
      [`achievements.progress.${achievementId}.completedAt`]: admin.firestore.Timestamp.now(),
      
      // Unlock rewards
      [`titles.unlocked`]: admin.firestore.FieldValue.arrayUnion(achievement.rewards.title),
      [`badges.unlocked`]: admin.firestore.FieldValue.arrayUnion(achievement.rewards.badge),
      
      // Grant currency
      gold: admin.firestore.FieldValue.increment(achievement.rewards.gold),
      tokens: admin.firestore.FieldValue.increment(achievement.rewards.tokens)
    });
    
    // Broadcast achievement unlocked event (if broadcasting is set up)
    if (hero.twitchUserId && global.broadcastToRoom) {
      global.broadcastToRoom(hero.twitchUserId, {
        type: 'achievement_unlocked',
        achievement: {
          id: achievementId,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          rewards: achievement.rewards
        }
      });
    }
    
  } catch (error) {
    console.error(`[Achievement] Error awarding ${achievementId} to ${heroId}:`, error);
  }
}

/**
 * Get all achievements with hero's progress
 */
async function getAchievementsWithProgress(heroId) {
  try {
    const [achievementsSnapshot, heroDoc] = await Promise.all([
      db.collection('achievements').orderBy('order').get(),
      db.collection('heroes').doc(heroId).get()
    ]);
    
    if (!heroDoc.exists) {
      throw new Error('Hero not found');
    }
    
    const hero = heroDoc.data();
    const achievements = [];
    
    achievementsSnapshot.forEach(doc => {
      const achievement = doc.data();
      const progress = hero.achievements?.progress?.[doc.id];
      
      achievements.push({
        ...achievement,
        id: doc.id,
        progress: {
          current: progress?.current || 0,
          total: achievement.requirement.count,
          completed: progress?.completed || false,
          completedAt: progress?.completedAt || null
        }
      });
    });
    
    return achievements;
  } catch (error) {
    console.error(`[Achievement] Error getting achievements for ${heroId}:`, error);
    throw error;
  }
}

/**
 * Equip a title
 */
async function equipTitle(heroId, title) {
  try {
    const heroRef = db.collection('heroes').doc(heroId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      throw new Error('Hero not found');
    }
    
    const hero = heroDoc.data();
    const unlockedTitles = hero.titles?.unlocked || [];
    
    // Check if title is unlocked
    if (!unlockedTitles.includes(title) && title !== null) {
      throw new Error('Title not unlocked');
    }
    
    await heroRef.update({
      'titles.equipped': title
    });
    
    console.log(`[Achievement] ${hero.name} equipped title: ${title}`);
    return true;
  } catch (error) {
    console.error(`[Achievement] Error equipping title for ${heroId}:`, error);
    throw error;
  }
}

/**
 * Equip a badge
 */
async function equipBadge(heroId, badge) {
  try {
    const heroRef = db.collection('heroes').doc(heroId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      throw new Error('Hero not found');
    }
    
    const hero = heroDoc.data();
    const unlockedBadges = hero.badges?.unlocked || [];
    
    // Check if badge is unlocked
    if (!unlockedBadges.includes(badge) && badge !== null) {
      throw new Error('Badge not unlocked');
    }
    
    await heroRef.update({
      'badges.equipped': badge
    });
    
    console.log(`[Achievement] ${hero.name} equipped badge: ${badge}`);
    return true;
  } catch (error) {
    console.error(`[Achievement] Error equipping badge for ${heroId}:`, error);
    throw error;
  }
}

export {
  trackAchievement,
  awardAchievement,
  getAchievementsWithProgress,
  equipTitle,
  equipBadge
};
