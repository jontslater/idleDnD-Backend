/**
 * Hero/guild create & update allow-list tests
 */

import request from 'supertest';
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import { applyTestEnv, TEST_JWT_SECRET } from './setupTestEnv.js';

applyTestEnv();

const HERO_ID = 'hero-write-test';
const GUILD_ID = 'guild-write-test';
const TWITCH = 'write-test-twitch';

function token() {
  return jwt.sign(
    { userId: HERO_ID, twitchUserId: TWITCH, twitchUsername: 'writetest' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('Hero/Guild Write Allow-list Tests\n');
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
        name: 'Leader',
        role: 'guardian',
        level: 5
      }
    },
    guilds: {
      [GUILD_ID]: {
        name: 'Test Guild',
        createdBy: HERO_ID,
        level: 2,
        gold: 5000,
        maxMembers: 30,
        memberIds: [HERO_ID],
        joinMode: 'open'
      }
    }
  };

  const { app, db } = await import('../src/index.js');

  console.log('\nTest 1: POST /api/heroes/ ignores progression injection');
  try {
    const res = await request(app)
      .post('/api/heroes/')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        role: 'mage',
        name: 'Fresh Mage',
        twitchUserId: TWITCH,
        level: 99,
        gold: 999999,
        skillPoints: 48,
        skills: { mage_skill_1: { points: 5 } },
        equipment: { weapon: { rarity: 'legendary' } }
      });
    assert.equal(res.status, 201);
    const heroId = res.body.id;
    const doc = await db.collection('heroes').doc(heroId).get();
    const hero = doc.data();
    assert.equal(hero.level, 1);
    assert.equal(hero.gold, 0);
    assert.equal(hero.skillPoints, 0);
    assert.deepEqual(hero.skills, {});
    assert.equal(hero.equipment.weapon, null);
    assert.equal(hero.role, 'mage');
    assert.equal(hero.name, 'Fresh Mage');
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 2: POST /api/guilds/ server defaults for roster/economy');
  try {
    const res = await request(app)
      .post('/api/guilds/')
      .set('Authorization', `Bearer ${token()}`)
      .send({
        name: 'New Guild',
        createdBy: HERO_ID,
        level: 50,
        gold: 1e6,
        memberIds: ['evil-hero'],
        maxMembers: 999
      });
    assert.equal(res.status, 201);
    assert.equal(res.body.level, 1);
    assert.equal(res.body.gold, 0);
    assert.equal(res.body.maxMembers, 30);
    assert.deepEqual(res.body.memberIds, [HERO_ID]);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 3: PUT /api/guilds/:id blocks memberIds/level writes');
  try {
    const res = await request(app)
      .put(`/api/guilds/${GUILD_ID}`)
      .set('Authorization', `Bearer ${token()}`)
      .send({
        heroId: HERO_ID,
        description: 'Updated motto',
        level: 99,
        gold: 999,
        memberIds: ['hacker']
      });
    assert.equal(res.status, 200);
    const doc = await db.collection('guilds').doc(GUILD_ID).get();
    const guild = doc.data();
    assert.equal(guild.description, 'Updated motto');
    assert.equal(guild.level, 2);
    assert.equal(guild.gold, 5000);
    assert.deepEqual(guild.memberIds, [HERO_ID]);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 4: PUT /api/guilds/:id forbidden for non-leader hero');
  try {
    await db.collection('heroes').doc('other-hero').set({
      twitchUserId: 'other-twitch',
      name: 'Other',
      role: 'mage'
    });
    const otherToken = jwt.sign(
      { userId: 'other-hero', twitchUserId: 'other-twitch', twitchUsername: 'other' },
      TEST_JWT_SECRET,
      { expiresIn: '1h' }
    );
    const res = await request(app)
      .put(`/api/guilds/${GUILD_ID}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ heroId: 'other-hero', name: 'Hijacked' });
    assert.equal(res.status, 403);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Hero/Guild write tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
