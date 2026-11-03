import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSkillPoints,
  resolveSkillPointFields,
  FIRST_SKILL_POINT_LEVEL
} from './skills.js';

describe('skill points from level', () => {
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
});
