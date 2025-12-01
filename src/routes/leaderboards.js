import express from 'express';
import { db } from '../index.js';
import { getLeaderboard, getUserRankings, updateLeaderboards } from '../services/leaderboardService.js';

const router = express.Router();

// Get leaderboard
router.get('/:type/:category', async (req, res) => {
  try {
    const { type, category } = req.params;
    
    if (type !== 'global' && type !== 'guild') {
      return res.status(400).json({ error: 'Invalid type' });
    }
    
    const validCategories = ['level', 'damage', 'healing', 'guildLevel', 'achievements'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const leaderboard = await getLeaderboard(type, category);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// Get user's rankings
router.get('/user/:userId', async (req, res) => {
  try {
    const rankings = await getUserRankings(req.params.userId);
    res.json(rankings);
  } catch (error) {
    console.error('Error fetching user rankings:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// Update leaderboards (admin endpoint)
router.post('/update', async (req, res) => {
  try {
    await updateLeaderboards();
    res.json({ success: true, message: 'Leaderboards updated' });
  } catch (error) {
    console.error('Error updating leaderboards:', error);
    res.status(500).json({ error: 'Failed to update leaderboards' });
  }
});

export default router;
