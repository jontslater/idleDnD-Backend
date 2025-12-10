import express from 'express';
import { db } from '../index.js';
import { getLeaderboard, getUserRankings, updateLeaderboards } from '../services/leaderboardService.js';

const router = express.Router();

// Get user's rankings (MUST be before /:type/:category route to avoid route conflict)
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      return res.status(400).json({ error: 'userId parameter is required and must be a non-empty string' });
    }
    
    const rankings = await getUserRankings(userId.trim());
    res.json(rankings);
  } catch (error) {
    console.error('Error fetching user rankings:', error);
    // Return 200 with empty object instead of 500 if hero not found
    if (error.message && error.message.includes('not found')) {
      return res.json({});
    }
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// Get leaderboard
router.get('/:type/:category', async (req, res) => {
  try {
    const { type, category } = req.params;
    console.log(`[Leaderboard Route] GET /${type}/${category}`);
    
    if (type !== 'global' && type !== 'guild') {
      console.log(`[Leaderboard Route] Invalid type: ${type}`);
      return res.status(400).json({ error: 'Invalid type' });
    }
    
    const validCategories = ['level', 'damage', 'healing', 'guildLevel', 'achievements', 'itemScore', 'gold'];
    if (!validCategories.includes(category)) {
      console.log(`[Leaderboard Route] Invalid category: ${category}`);
      return res.status(400).json({ error: 'Invalid category' });
    }
    
    const leaderboard = await getLeaderboard(type, category);
    console.log(`[Leaderboard Route] Returning leaderboard with ${leaderboard.entries?.length || 0} entries`);
    res.json(leaderboard);
  } catch (error) {
    console.error('[Leaderboard Route] Error fetching leaderboard:', error);
    console.error('[Leaderboard Route] Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch leaderboard', details: error.message });
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
