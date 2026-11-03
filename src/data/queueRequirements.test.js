import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEUE_RARITY_GEAR_VALUES,
  computeQueueGearScore,
  calculateGearScore
} from './queueRequirements.js';

describe('queue gear score', () => {
  it('matches TNEWFE QUEUE_RARITY_GEAR_VALUES including mythic', () => {
    assert.deepEqual(QUEUE_RARITY_GEAR_VALUES, {
      common: 10,
      uncommon: 25,
      rare: 50,
      epic: 100,
      legendary: 200,
      mythic: 400
    });
  });

  it('sums rarity values across all equipped slots', () => {
    const hero = {
      equipment: {
        weapon: { rarity: 'rare' },
        armor: { rarity: 'epic' },
        ring1: { rarity: 'mythic' },
        boots: null
      }
    };
    assert.equal(computeQueueGearScore(hero), 50 + 100 + 400);
    assert.equal(calculateGearScore(hero), computeQueueGearScore(hero));
  });

  it('ignores items without rarity', () => {
    assert.equal(computeQueueGearScore({ equipment: { weapon: { attack: 99 } } }), 0);
  });
});
