import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCombatStateToUpdate,
  applyDamageToHero,
  applyHealToHero,
  AUTO_RESURRECT_DELAY_MS,
  normalizeHeroCombatState,
  reviveHero,
  tickAutoResurrection
} from './heroCombatState.js';

describe('heroCombatState', () => {
  it('marks hero dead when HP reaches 0 on update (client omitted isDead)', () => {
    const now = 1_700_000_000_000;
    const out = applyCombatStateToUpdate(
      { maxHp: 500, hp: 40, isDead: false, deathTime: null },
      { hp: 0 },
      { now }
    );
    assert.equal(out.hp, 0);
    assert.equal(out.isDead, true);
    assert.equal(out.deathTime, now);
  });

  it('applyDamageToHero can reduce HP to 0 with no minimum HP floor', () => {
    const now = 1_700_000_000_000;
    const { hero, died, hpDamage } = applyDamageToHero(
      { maxHp: 100, hp: 5, shield: 0, isDead: false },
      5,
      { now }
    );
    assert.equal(hpDamage, 5);
    assert.equal(hero.hp, 0);
    assert.equal(died, true);
    assert.equal(hero.isDead, true);
  });

  it('does not apply damage to already dead heroes', () => {
    const { hero, alreadyDead, hpDamage } = applyDamageToHero(
      { maxHp: 100, hp: 0, isDead: true, deathTime: 123 },
      50
    );
    assert.equal(alreadyDead, true);
    assert.equal(hpDamage, 0);
    assert.equal(hero.hp, 0);
    assert.equal(hero.isDead, true);
  });

  it('absorbs damage with shield before HP', () => {
    const { hero, hpDamage, shieldDamage } = applyDamageToHero(
      { maxHp: 100, hp: 30, shield: 10, isDead: false },
      15
    );
    assert.equal(shieldDamage, 10);
    assert.equal(hpDamage, 5);
    assert.equal(hero.hp, 25);
    assert.equal(hero.shield, 0);
    assert.equal(hero.isDead, false);
  });

  it('explicit revive clears death when isDead is false and HP > 0', () => {
    const out = applyCombatStateToUpdate(
      { maxHp: 200, hp: 0, isDead: true, deathTime: 999 },
      { isDead: false, hp: 100 },
      { now: 1_700_000_000_000 }
    );
    assert.equal(out.isDead, false);
    assert.equal(out.deathTime, null);
    assert.equal(out.hp, 100);
  });

  it('heal does not resurrect dead heroes', () => {
    const { actualHeal, hero } = applyHealToHero(
      { maxHp: 100, hp: 0, isDead: true, deathTime: 1 },
      40
    );
    assert.equal(actualHeal, 0);
    assert.equal(hero.isDead, true);
  });

  it('reviveHero restores 50% HP by default', () => {
    const revived = reviveHero({ maxHp: 200, hp: 0, isDead: true, deathTime: 1 });
    assert.equal(revived.isDead, false);
    assert.equal(revived.hp, 100);
    assert.equal(revived.deathTime, null);
  });

  it('tickAutoResurrection waits 60s then revives at 50% HP', () => {
    const deathTime = 1_000_000;
    const before = tickAutoResurrection(
      { maxHp: 100, hp: 0, isDead: true, deathTime },
      { now: deathTime + AUTO_RESURRECT_DELAY_MS - 1 }
    );
    assert.equal(before.resurrected, false);

    const after = tickAutoResurrection(
      { maxHp: 100, hp: 0, isDead: true, deathTime },
      { now: deathTime + AUTO_RESURRECT_DELAY_MS }
    );
    assert.equal(after.resurrected, true);
    assert.equal(after.hero.hp, 50);
    assert.equal(after.hero.isDead, false);
  });

  it('normalizeHeroCombatState clamps HP to maxHp but not above 0 minimum', () => {
    const state = normalizeHeroCombatState({ maxHp: 80, hp: -3, isDead: false });
    assert.equal(state.hp, 0);
    assert.equal(state.isDead, true);
  });
});
