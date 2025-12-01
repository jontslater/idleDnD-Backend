import admin from 'firebase-admin';
import { db } from '../index.js';
import { getDailyReward, getMonthlyReward } from '../data/loginRewards.js';

// Helper: Get or create user document in users collection
// userId is Twitch/TikTok OAuth ID
async function getOrCreateUser(userId, provider = 'twitch') {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    // Create new user document
    await userRef.set({
      oauthProvider: provider,
      oauthId: userId,
      lastLogin: null,
      rewardStreak: 0,
      totalLoginDays: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
      id: userId,
      oauthProvider: provider,
      oauthId: userId,
      lastLogin: null,
      rewardStreak: 0,
      totalLoginDays: 0
    };
  }
  
  return { id: userId, ...userDoc.data() };
}

// Helper: Find user's active hero (most recently updated)
async function findActiveHero(userId) {
  // Try as Twitch user ID first
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', userId)
    .get();
  
  if (!heroesSnapshot.empty) {
    // Get most recently updated hero
    let heroes = heroesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    heroes.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? new Date(a.updatedAt ?? 0).getTime();
      const bTime = b.updatedAt?.toMillis?.() ?? new Date(b.updatedAt ?? 0).getTime();
      return bTime - aTime;
    });
    return { hero: heroes[0], heroRef: db.collection('heroes').doc(heroes[0].id) };
  }
  
  // Try as document ID (backward compatibility)
  const heroDoc = await db.collection('heroes').doc(userId).get();
  if (heroDoc.exists) {
    return { hero: heroDoc.data(), heroRef: heroDoc.ref };
  }
  
  return null;
}

// Claim daily login reward
// userId is Twitch/TikTok OAuth ID
export async function claimLoginReward(userId, provider = 'twitch') {
  try {
    // Get or create user document (stores login reward data per user)
    const user = await getOrCreateUser(userId, provider);
    const userRef = db.collection('users').doc(userId);
    
    // Find user's active hero to apply rewards to
    const heroData = await findActiveHero(userId);
    if (!heroData) {
      throw new Error('No hero found for user');
    }
    
    const { hero: activeHero, heroRef: activeHeroRef } = heroData;
    
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const lastLogin = user.lastLogin ? new Date(user.lastLogin.toDate ? user.lastLogin.toDate() : user.lastLogin).toISOString().split('T')[0] : null;
    
    // Check if already claimed today
    if (lastLogin === today) {
      return {
        success: false,
        message: 'Reward already claimed today',
        canClaim: false,
        rewardStreak: user.rewardStreak || 0,
        totalLoginDays: user.totalLoginDays || 0
      };
    }
    
    // Calculate consecutive days (streak)
    let newStreak = user.rewardStreak || 0;
    let totalDays = user.totalLoginDays || 0;
    
    if (lastLogin) {
      const lastDate = new Date(lastLogin);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day - continue streak
        newStreak += 1;
      } else if (daysDiff > 1) {
        // Streak broken - reset to 1
        newStreak = 1;
      }
      // If daysDiff === 0, already handled above (same day)
    } else {
      // First login
      newStreak = 1;
    }
    
    totalDays += 1;
    
    // Calculate reward day (1-7 cycle based on streak)
    const rewardDay = ((newStreak - 1) % 7) + 1;
    const dailyReward = getDailyReward(rewardDay);
    
    if (!dailyReward) {
      throw new Error('Invalid reward day');
    }
    
    // Check monthly milestones
    const monthlyReward = getMonthlyReward(totalDays);
    
    // Update user document with new login data
    await userRef.update({
      lastLogin: admin.firestore.Timestamp.now(),
      rewardStreak: newStreak,
      totalLoginDays: totalDays,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Apply rewards to active hero
    const heroUpdates = {};
    
    // Add gold
    if (dailyReward.gold) {
      heroUpdates.gold = admin.firestore.FieldValue.increment(dailyReward.gold);
    }
    
    // Add tokens
    if (dailyReward.tokens) {
      heroUpdates.tokens = admin.firestore.FieldValue.increment(dailyReward.tokens);
    }
    
    // Add monthly reward if applicable
    if (monthlyReward) {
      if (monthlyReward.gold) {
        heroUpdates.gold = admin.firestore.FieldValue.increment(monthlyReward.gold);
      }
      if (monthlyReward.tokens) {
        heroUpdates.tokens = admin.firestore.FieldValue.increment(monthlyReward.tokens);
      }
    }
    
    if (Object.keys(heroUpdates).length > 0) {
      heroUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      await activeHeroRef.update(heroUpdates);
    }
    
    return {
      success: true,
      message: `Daily reward claimed! Day ${rewardDay} of 7`,
      reward: dailyReward,
      monthlyReward: monthlyReward || null,
      rewardStreak: newStreak,
      totalLoginDays: totalDays,
      nextRewardDay: rewardDay === 7 ? 1 : rewardDay + 1
    };
  } catch (error) {
    console.error('Error claiming login reward:', error);
    throw error;
  }
}

// Get login reward status
// userId is Twitch/TikTok OAuth ID
export async function getLoginRewardStatus(userId, provider = 'twitch') {
  try {
    // Get user document from users collection
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    
    // If user doesn't exist, return default status (can claim)
    if (!userDoc.exists) {
      return {
        canClaim: true,
        lastLoginDate: null,
        rewardStreak: 0,
        totalLoginDays: 0,
        currentRewardDay: 1,
        nextReward: getDailyReward(1)
      };
    }
    
    const user = userDoc.data();
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = user.lastLogin ? new Date(user.lastLogin.toDate ? user.lastLogin.toDate() : user.lastLogin).toISOString().split('T')[0] : null;
    const canClaim = lastLogin !== today;
    
    // Calculate current reward day based on streak
    const rewardStreak = user.rewardStreak || 0;
    const rewardDay = rewardStreak === 0 ? 1 : ((rewardStreak - 1) % 7) + 1;
    const nextReward = getDailyReward(rewardDay);
    
    return {
      canClaim,
      lastLoginDate: lastLogin,
      rewardStreak: rewardStreak,
      totalLoginDays: user.totalLoginDays || 0,
      currentRewardDay: rewardDay,
      nextReward
    };
  } catch (error) {
    console.error('Error getting login reward status:', error);
    // Return default status on error instead of throwing
    return {
      canClaim: true,
      lastLoginDate: null,
      rewardStreak: 0,
      totalLoginDays: 0,
      currentRewardDay: 1,
      nextReward: getDailyReward(1)
    };
  }
}
