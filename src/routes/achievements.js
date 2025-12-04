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
    
    console.log(`[Achievements API] GET / - Total achievements: ${ACHIEVEMENTS.length}`);
    console.log('[Achievements API] First 5:', ACHIEVEMENTS.slice(0, 5).map(a => ({ id: a.id, name: a.name, title: a.rewards.title })));
    console.log('[Achievements API] Achievement IDs:', ACHIEVEMENTS.map(a => a.id));
    
    if (category) {
      const achievements = getAchievementsByCategory(category);
      console.log(`[Achievements API] Filtered by ${category}: ${achievements.length} achievements`);
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
    
    console.log(`[Achievements API] GET /${req.params.userId}`);
    console.log(`[Achievements API] Hero unlocked: ${achievements.achievements?.length || 0} achievements`);
    console.log(`[Achievements API] Hero titles: ${achievements.titles?.length || 0} titles`);
    console.log(`[Achievements API] Active title: ${achievements.activeTitle}`);
    console.log('[Achievements API] All titles:', achievements.titles);
    
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

export default router;
