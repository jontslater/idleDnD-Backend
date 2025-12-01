import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { getAllSkills, getSkillsForClass, calculateSkillPoints } from '../data/skills.js';
import { getHeroSkills, allocateSkillPoint, resetSkills } from '../services/skillService.js';

const router = express.Router();

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
// MUST be before /:userId route to avoid matching "retroactive-points" as a userId
router.post('/retroactive-points/:userId', async (req, res) => {
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
    const pointsSpent = Object.values(hero.skills || {}).reduce((sum, skill) => sum + (skill.points || 0), 0);
    
    // Calculate what the skill points should be (total earned minus what's been spent)
    const shouldHavePoints = totalPoints - pointsSpent;
    
    // Calculate how many points to add (difference between what they should have and what they currently have)
    const pointsToAdd = shouldHavePoints - currentPoints;
    
    console.log(`[Retroactive Points] Hero ${userId}: Level ${level}`);
    console.log(`  Total Points (should have earned): ${totalPoints}`);
    console.log(`  Current Points (available): ${currentPoints}`);
    console.log(`  Current Earned (tracked): ${currentEarned}`);
    console.log(`  Points Spent (in skills): ${pointsSpent}`);
    console.log(`  Should Have (available): ${shouldHavePoints}`);
    console.log(`  Points To Add: ${pointsToAdd}`);
    
    // Always update to ensure correct values, even if they match
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
        pointsSpent: pointsSpent,
        pointsAdded: pointsToAdd
      });
    } else {
      return res.json({ 
        success: true, 
        message: 'Hero already has correct number of skill points',
        skillPoints: currentPoints,
        totalEarned: totalPoints,
        pointsSpent: pointsSpent,
        shouldHave: shouldHavePoints
      });
    }
  } catch (error) {
    console.error('Error retroactively adding skill points:', error);
    res.status(500).json({ error: 'Failed to retroactively add skill points' });
  }
});

// Get skills for a specific class
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

// Get hero's skills
router.get('/:userId', async (req, res) => {
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

// Allocate skill point
router.post('/:userId/allocate', async (req, res) => {
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

// Reset all skills
router.post('/:userId/reset', async (req, res) => {
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

export default router;
