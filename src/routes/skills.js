import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { getAllSkills, getSkillsForClass, calculateSkillPoints } from '../data/skills.js';
import {
  buildPublicSkillDefinitionsPayload,
  writeSkillDefinitionsJson,
  getSkillDefinitionsJsonPath
} from '../data/skillDefinitions.js';
import {
  getHeroSkills,
  allocateSkillPoint,
  resetSkills,
  respecSkillsForPlayer,
  DEFAULT_PLAYER_RESPEC_GOLD_COST
} from '../services/skillService.js';

import { requireAuth, requireOwnership, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// Canonical definitions (public)
router.get('/definitions', (req, res) => {
  try {
    const payload = buildPublicSkillDefinitionsPayload();
    res.json({
      ...payload,
      jsonExportPath: 'data/skillDefinitions.json',
      jsonAbsoluteHint: getSkillDefinitionsJsonPath()
    });
  } catch (error) {
    console.error('Error fetching skill definitions:', error);
    res.status(500).json({ error: 'Failed to fetch skill definitions' });
  }
});

// Get all skills (for reference)
router.get('/', (req, res) => {
  try {
    const skills = getAllSkills();
    res.json(skills);
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// Retroactively calculate and add skill points for a specific hero
router.post('/retroactive-points/:userId', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { userId } = req.params;
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    const level = hero.level || 1;

    if (level < 6) {
      return res.json({
        success: true,
        message: 'Hero is below level 6, no skill points available',
        skillPoints: 0
      });
    }

    const totalPoints = calculateSkillPoints(level);
    const currentPoints = hero.skillPoints || 0;
    const currentEarned = hero.skillPointsEarned || 0;
    const pointsSpent = Object.values(hero.skills || {}).reduce(
      (sum, skill) => sum + (skill.points || 0),
      0
    );

    const shouldHavePoints = totalPoints - pointsSpent;
    const pointsToAdd = shouldHavePoints - currentPoints;

    if (pointsToAdd > 0 || currentEarned !== totalPoints) {
      await heroRef.update({
        skillPoints: shouldHavePoints,
        skillPointsEarned: totalPoints,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.json({
        success: true,
        message: pointsToAdd > 0 ? `Added ${pointsToAdd} skill points` : 'Updated skill points tracking',
        previousPoints: currentPoints,
        newPoints: shouldHavePoints,
        totalEarned: totalPoints,
        pointsSpent,
        pointsAdded: pointsToAdd
      });
    }

    return res.json({
      success: true,
      message: 'Hero already has correct number of skill points',
      skillPoints: currentPoints,
      totalEarned: totalPoints,
      pointsSpent,
      shouldHave: shouldHavePoints
    });
  } catch (error) {
    console.error('Error retroactively adding skill points:', error);
    res.status(500).json({ error: 'Failed to retroactively add skill points' });
  }
});

router.get('/class/:className', (req, res) => {
  try {
    const { className } = req.params;
    const skills = getSkillsForClass(className);
    res.json(skills);
  } catch (error) {
    console.error('Error fetching class skills:', error);
    res.status(500).json({ error: 'Failed to fetch class skills' });
  }
});

router.get('/:userId', requireAuth, requireOwnership, async (req, res) => {
  try {
    const skills = await getHeroSkills(req.params.userId);
    if (!skills) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    res.json(skills);
  } catch (error) {
    console.error('Error fetching hero skills:', error);
    res.status(500).json({ error: 'Failed to fetch hero skills' });
  }
});

router.post('/:userId/allocate', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { skillId } = req.body;
    if (!skillId) {
      return res.status(400).json({ error: 'Skill ID required' });
    }

    const result = await allocateSkillPoint(req.params.userId, skillId);
    res.json(result);
  } catch (error) {
    console.error('Error allocating skill point:', error);
    res.status(400).json({ error: error.message || 'Failed to allocate skill point' });
  }
});

router.post('/:userId/respec', requireAuth, requireOwnership, async (req, res) => {
  try {
    const goldCost = req.body.goldCost ?? DEFAULT_PLAYER_RESPEC_GOLD_COST;
    const result = await respecSkillsForPlayer(req.params.userId, { goldCost });
    res.json(result);
  } catch (error) {
    console.error('Error respeccing skills:', error);
    res.status(400).json({ error: error.message || 'Failed to respec skills' });
  }
});

router.post('/:userId/reset', requireAdmin, async (req, res) => {
  try {
    const { cost } = req.body;
    const resetCost = cost || 500;

    const result = await resetSkills(req.params.userId, resetCost);
    res.json(result);
  } catch (error) {
    console.error('Error resetting skills:', error);
    res.status(400).json({ error: error.message || 'Failed to reset skills' });
  }
});

export function ensureSkillDefinitionsExported() {
  try {
    writeSkillDefinitionsJson();
  } catch (err) {
    console.warn('[skills] Failed to write skillDefinitions.json:', err.message);
  }
}

export default router;
