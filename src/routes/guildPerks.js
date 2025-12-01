import express from 'express';
import { db } from '../index.js';
import { calculateGuildPerks, getGuildPerksForHero } from '../services/guildPerksService.js';

const router = express.Router();

// Get guild perks for a hero
router.get('/hero/:userId', async (req, res) => {
  try {
    const perks = await getGuildPerksForHero(req.params.userId);
    res.json(perks || { message: 'No guild perks' });
  } catch (error) {
    console.error('Error getting guild perks:', error);
    res.status(500).json({ error: 'Failed to get guild perks' });
  }
});

// Calculate perks for a guild level
router.get('/calculate/:level', (req, res) => {
  try {
    const level = Number(req.params.level);
    const perks = calculateGuildPerks(level);
    res.json(perks);
  } catch (error) {
    console.error('Error calculating guild perks:', error);
    res.status(500).json({ error: 'Failed to calculate perks' });
  }
});

export default router;
