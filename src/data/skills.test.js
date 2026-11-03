import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSkillPoints,
  totalSkillPointsEarnedForLevel,
  resolveSkillPointFields,
  FIRST_SKILL_POINT_LEVEL,
  SKILL_POINT_LEVEL_STEP,
  MAX_HERO_LEVEL_FOR_SKILLS
} from './skills.js';

/** Mirror of TNEWFE `src/game/economy/progression.ts` for parity tests. */
function tnewfeTotalSkillPointsEarnedForLevel(level) {
  const FIRST_SKILL_POINT_LEVEL = 6;
  const SKILL_POINT_LEVEL_STEP = 2;
  const MAX_HERO_LEVEL = 100;
  if (level < FIRST_SKILL_POINT_LEVEL) return 0;
  const capped = Math.min(level, MAX_HERO_LEVEL);
  let count = 0;
  for (let l = FIRST_SKILL_POINT_LEVEL; l <= capped; l += SKILL_POINT_LEVEL_STEP) {
    count++;
  }
  return count;
}

describe('skill points from level', () => {
  it('matches TNEWFE progression.ts constants and totalSkillPointsEarnedForLevel', () => {
    assert.equal(MAX_HERO_LEVEL_FOR_SKILLS, 100);
    assert.equal(FIRST_SKILL_POINT_LEVEL, 6);
    assert.equal(SKILL_POINT_LEVEL_STEP, 2);
    for (let level = 1; level <= 102; level++) {
      assert.equal(
        calculateSkillPoints(level),
        tnewfeTotalSkillPointsEarnedForLevel(level),
        `level ${level}`
      );
      assert.equal(totalSkillPointsEarnedForLevel(level), calculateSkillPoints(level));
    }
  });

  it('awards no points before level 6', () => {
    assert.equal(FIRST_SKILL_POINT_LEVEL, 6);
    assert.equal(calculateSkillPoints(1), 0);
    assert.equal(calculateSkillPoints(5), 0);
  });

  it('awards first point at level 6 then every 2 levels through 100', () => {
    assert.equal(calculateSkillPoints(6), 1);
    assert.equal(calculateSkillPoints(7), 1);
    assert.equal(calculateSkillPoints(8), 2);
    assert.equal(calculateSkillPoints(100), 48);
    assert.equal(calculateSkillPoints(101), 48);
  });

  it('resolveSkillPointFields subtracts allocated skill tree points', () => {
    const skills = { bard_skill_0: { points: 3 } };
    assert.deepEqual(resolveSkillPointFields(10, skills), {
      skillPointsEarned: 3,
      skillPoints: 0
    });
  });

  it('ignores inflated client totals when recomputing from level', () => {
    const fields = resolveSkillPointFields(20, {});
    assert.equal(fields.skillPointsEarned, 8);
    assert.equal(fields.skillPoints, 8);
  });

  it('clamps skillPoints at 0 when spent exceeds earned without mutating skills', () => {
    const skills = {
      bard_skill_0: { points: 20 },
      bard_skill_1: { points: 5 }
    };
    const fields = resolveSkillPointFields(10, skills);
    assert.equal(fields.skillPointsEarned, 3);
    assert.equal(fields.skillPoints, 0);
    assert.equal(skills.bard_skill_0.points, 20);
    assert.equal(skills.bard_skill_1.points, 5);
  });
});
