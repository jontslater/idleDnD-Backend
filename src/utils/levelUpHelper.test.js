import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateMaxXp, processLevelUps } from './levelUpHelper.js';

describe('levelUpHelper', () => {
  it('uses polynomial maxXp 40*l^2+300*l-240', () => {
    assert.equal(calculateMaxXp(1), 100);
    assert.equal(calculateMaxXp(10), 6760);
    assert.equal(calculateMaxXp(100), 429760);
  });

  it('includes authoritative skill points when leveling up', () => {
    const hero = {
      level: 5,
      xp: 0,
      maxXp: calculateMaxXp(5),
      role: 'bard',
      maxHp: 100,
      hp: 100,
      attack: 10,
      defense: 5,
      skills: {}
    };
    const result = processLevelUps(hero, calculateMaxXp(5) + 1);
    assert.equal(result.leveledUp, true);
    assert.equal(result.newLevel, 6);
    assert.equal(result.updates.skillPointsEarned, 1);
    assert.equal(result.updates.skillPoints, 1);
  });
});
