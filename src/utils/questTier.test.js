import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getTierForLevel, filterQuestsForHeroLevel } from './questTier.js';
import { buildPeriodKey } from './questPeriod.js';

describe('questTier', () => {
  it('maps levels to tiers', () => {
    assert.equal(getTierForLevel(1), 'newbie');
    assert.equal(getTierForLevel(10), 'newbie');
    assert.equal(getTierForLevel(11), 'intermediate');
    assert.equal(getTierForLevel(41), 'elite');
  });

  it('filters quests to hero tier only', () => {
    const quests = [
      { id: 'a', tier: 'newbie', objective: { type: 'kill', target: 10 } },
      { id: 'b', tier: 'elite', objective: { type: 'kill', target: 200 } }
    ];
    const filtered = filterQuestsForHeroLevel(quests, 5);
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, 'a');
  });
});

describe('questPeriod', () => {
  it('builds stable daily period keys in UTC', () => {
    const key = buildPeriodKey('daily', new Date('2026-11-03T12:00:00Z'));
    assert.equal(key, 'daily-2026-11-03');
  });
});
