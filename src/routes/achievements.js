import express from 'express';
import { 
  getAchievementsWithProgress, 
  equipTitle, 
  equipBadge 
} from '../services/achievementService.js';

const router = express.Router();

/**
 * GET /api/achievements/:heroId
 * Get all achievements with progress for a hero
 */
router.get('/:heroId', async (req, res) => {
  try {
    const { heroId } = req.params;
    const achievements = await getAchievementsWithProgress(heroId);
    res.json(achievements);
  } catch (error) {
    console.error('[API] Error getting achievements:', error);
    res.status(500).json({ error: 'Failed to get achievements' });
  }
});

/**
 * POST /api/achievements/:heroId/equip-title
 * Equip a title for a hero
 */
router.post('/:heroId/equip-title', async (req, res) => {
  try {
    const { heroId } = req.params;
    const { title } = req.body;
    
    await equipTitle(heroId, title);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error equipping title:', error);
    res.status(500).json({ error: error.message || 'Failed to equip title' });
  }
});

/**
 * POST /api/achievements/:heroId/equip-badge
 * Equip a badge for a hero
 */
router.post('/:heroId/equip-badge', async (req, res) => {
  try {
    const { heroId } = req.params;
    const { badge } = req.body;
    
    await equipBadge(heroId, badge);
    res.json({ success: true });
  } catch (error) {
    console.error('[API] Error equipping badge:', error);
    res.status(500).json({ error: error.message || 'Failed to equip badge' });
  }
});

export default router;
