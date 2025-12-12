import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { ACHIEVEMENTS, getAchievementsByCategory } from '../data/achievements.js';
import { getHeroAchievements, setActiveTitle, checkAchievements } from '../services/achievementService.js';

const router = express.Router();

// Get all achievements
router.get('/', (req, res) => {
  try {
    const { category } = req.query;
    
    if (category) {
      const achievements = getAchievementsByCategory(category);
      res.json(achievements);
    } else {
      res.json(ACHIEVEMENTS);
    }
  } catch (error) {
    console.error('Error fetching achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Get hero's achievements
router.get('/:userId', async (req, res) => {
  try {
    const achievements = await getHeroAchievements(req.params.userId);
    if (!achievements) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    res.json(achievements);
  } catch (error) {
    console.error('Error fetching hero achievements:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// Check and unlock achievements (called after actions)
router.post('/check', async (req, res) => {
  try {
    const { userId, actionType, actionValue } = req.body;
    
    if (!userId || !actionType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const newlyUnlocked = await checkAchievements(userId, actionType, actionValue);
    
    res.json({
      success: true,
      newlyUnlocked,
      count: newlyUnlocked.length
    });
  } catch (error) {
    console.error('Error checking achievements:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

// Set active title
router.put('/:userId/title', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title required' });
    }
    
    const result = await setActiveTitle(userId, title);
    res.json(result);
  } catch (error) {
    console.error('Error setting title:', error);
    res.status(400).json({ error: error.message || 'Failed to set title' });
  }
});

// Sync achievement titles for a hero (check all achievements and add missing titles)
// This re-evaluates all achievements based on current hero stats/progress
router.post('/:userId/sync-titles', async (req, res) => {
  try {
    const { userId } = req.params;
    const { checkAchievements } = await import('../services/achievementService.js');
    
    // checkAchievements doesn't use actionType - it checks ALL achievements
    // and compares them against current hero stats. We just need to call it once.
    // The actionType parameter is for future use but currently all achievements are checked.
    const newlyUnlocked = await checkAchievements(userId, 'sync', 0);
    
    // Get updated hero data to return current titles
    const { getHeroAchievements } = await import('../services/achievementService.js');
    const heroAchievements = await getHeroAchievements(userId);
    
    res.json({
      success: true,
      newlyUnlocked: newlyUnlocked.length,
      titles: heroAchievements?.titles || [],
      message: `Synced achievements. ${newlyUnlocked.length} new achievement(s) unlocked.`
    });
  } catch (error) {
    console.error('Error syncing achievement titles:', error);
    res.status(500).json({ error: error.message || 'Failed to sync titles' });
  }
});

// Unlock all achievements for a specific user (admin/dev only)
router.post('/:userId/unlock-all', async (req, res) => {
  try {
    const { userId } = req.params;
    const heroRef = db.collection('heroes').doc(userId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = heroDoc.data();
    const unlockedAchievements = hero.achievements || [];
    const unlockedIds = unlockedAchievements.map(a => a.achievementId);
    const titles = hero.titles || [];
    let newTitlesAdded = 0;
    let newAchievementsAdded = 0;
    let totalTokens = 0;
    
    // Unlock all achievements that aren't already unlocked
    for (const achievement of ACHIEVEMENTS) {
      if (!unlockedIds.includes(achievement.id)) {
        unlockedAchievements.push({
          achievementId: achievement.id,
          unlockedAt: admin.firestore.Timestamp.now(),
          progress: achievement.requirements.target
        });
        newAchievementsAdded++;
        
        // Add title if it has one
        if (achievement.rewards?.title && !titles.includes(achievement.rewards.title)) {
          titles.push(achievement.rewards.title);
          newTitlesAdded++;
        }
        
        // Add tokens if reward has them
        if (achievement.rewards?.tokens) {
          totalTokens += achievement.rewards.tokens;
        }
      }
    }
    
    // Update hero with all achievements and titles
    const updates = {
      achievements: unlockedAchievements,
      titles: titles,
      tokens: (hero.tokens || 0) + totalTokens,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await heroRef.update(updates);
    
    res.json({
      success: true,
      message: `Unlocked all achievements for ${hero.name || userId}`,
      newAchievements: newAchievementsAdded,
      newTitles: newTitlesAdded,
      totalTokensAdded: totalTokens,
      totalTitles: titles.length,
      totalAchievements: unlockedAchievements.length
    });
  } catch (error) {
    console.error('Error unlocking all achievements:', error);
    res.status(500).json({ error: error.message || 'Failed to unlock achievements' });
  }
});

export default router;
