/**
 * Skills: allow-list, allocation, respec, level-up points, definitions
 */

import request from 'supertest';
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import { applyTestEnv, TEST_JWT_SECRET } from './setupTestEnv.js';

applyTestEnv();

const HERO_ID = 'hero-skills-test';
const TWITCH = 'skills-twitch-1';

function token() {
  return jwt.sign(
    { userId: HERO_ID, twitchUserId: TWITCH, twitchUsername: 'skilluser' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('Skills Tests\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  globalThis.__IN_MEMORY_FIRESTORE_SEED__ = {
    streamerSettings: {
      streamer1: { overlayKey: 'overlay-key-streamer1-32bytes!!', twitchUsername: 'streamer1' }
    },
    heroes: {
      [HERO_ID]: {
        twitchUserId: TWITCH,
        name: 'Skill Hero',
        role: 'berserker',
        level: 10,
        skillPoints: 2,
        skillPointsEarned: 3,
        skills: { berserker_skill_1: { points: 1, unlockedAt: 6 } }
      }
    }
  };

  const { app, db } = await import('../src/index.js');
  const { processLevelUps, skillPointPatchForLevelUp } = await import('../src/utils/levelUpHelper.js');
  const { pickPlayerEditableHeroFields } = await import('../src/utils/heroUpdateAllowList.js');
  const { respecSkillsForPlayer, allocateSkillPoint } = await import('../src/services/skillService.js');
  const { getActiveAbilityForClass, ROLE_ACTIVE_ABILITIES, applyActiveCooldownMs } = await import(
    '../src/data/skillDefinitions.js'
  );

  console.log('\nTest 1: PUT hero rejects skill/level writes');
  try {
    const res = await request(app)
      .put(`/api/heroes/${HERO_ID}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({
        skills: { berserker_skill_9: { points: 99 } },
        skillPoints: 999,
        level: 100,
        gold: 1e9,
        name: 'Renamed'
      });
    assert.equal(res.status, 200);
    const doc = await db.collection('heroes').doc(HERO_ID).get();
    const hero = doc.data();
    assert.equal(hero.name, 'Renamed');
    assert.equal(hero.skillPoints, 2);
    assert.equal(hero.level, 10);
    assert.equal(hero.skills.berserker_skill_1.points, 1);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 2: rank cap at 5');
  try {
    await db.collection('heroes').doc(HERO_ID).update({
      skillPoints: 10,
      skillPointsEarned: 10,
      skills: {}
    });
    for (let i = 0; i < 5; i++) {
      await allocateSkillPoint(HERO_ID, 'berserker_skill_1');
    }
    let err;
    try {
      await allocateSkillPoint(HERO_ID, 'berserker_skill_1');
    } catch (e) {
      err = e;
    }
    assert.ok(err?.message?.includes('maxed'));
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 3: respec refunds all earned points');
  try {
    await db.collection('heroes').doc(HERO_ID).update({
      level: 12,
      skillPoints: 0,
      skillPointsEarned: 4,
      skills: { berserker_skill_1: { points: 3 }, berserker_skill_2: { points: 1 } }
    });
    await respecSkillsForPlayer(HERO_ID);
    const hero = (await db.collection('heroes').doc(HERO_ID).get()).data();
    assert.deepEqual(hero.skills, {});
    assert.equal(hero.skillPoints, 4);
    assert.equal(hero.skillPointsEarned, 4);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 4: level-up awards skill points once');
  try {
    const base = { level: 5, skillPoints: 0, skillPointsEarned: 0, role: 'mage', maxHp: 100, hp: 100, attack: 10, defense: 5 };
    const r1 = processLevelUps(base, 5000);
    assert.ok(r1.leveledUp);
    assert.equal(r1.updates.skillPointsEarned, 1);
    assert.equal(r1.updates.skillPoints, 1);
    const hero2 = { ...base, ...r1.updates, level: r1.newLevel };
    const r2 = processLevelUps(hero2, hero2.xp);
    assert.equal(r2.levelsGained, 0);
    assert.equal(r2.updates.skillPoints, undefined);
    const patchOnly = skillPointPatchForLevelUp(hero2, hero2.level);
    assert.equal(Object.keys(patchOnly).length, 0);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 5: GET /api/skills/definitions role actives');
  try {
    const res = await request(app).get('/api/skills/definitions');
    assert.equal(res.status, 200);
    assert.equal(res.body.activeAbilities.byRole.tank.id, 'shieldWall');
    assert.equal(res.body.activeAbilities.byRole.healer.cooldownMs, 30000);
    assert.equal(res.body.activeAbilities.byRole.dps.id, 'burstStrike');
    assert.equal(res.body.activeAbilities.resolvedByClass.guardian.id, 'shieldWall');
    assert.equal(getActiveAbilityForClass('shaman').id, 'chainLightning');
    assert.equal(applyActiveCooldownMs(30000, 40), 18000);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 6: allow-list helper blocks progression fields');
  try {
    const { allowed, rejected } = pickPlayerEditableHeroFields({ name: 'x', level: 9 });
    assert.equal(allowed.name, 'x');
    assert.ok(rejected.includes('level'));
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Skills tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
