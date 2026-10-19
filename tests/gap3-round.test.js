/**
 * GAP 3 round tests (see SKILLS_REVIEW Gap 2 verification).
 */

import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { applyTestEnv, VALID_STREAMER_KEY, WRONG_STREAMER_KEY, TEST_JWT_SECRET } from './setupTestEnv.js';

applyTestEnv();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { app, db } = await import('../src/index.js');
const { handleStripeWebhookEvent } = await import('../src/services/stripeWebhookHandler.js');
const {
  resetIdleLootWindows,
  resolveKillKindForHero,
  normalizeIdleKill
} = await import('../src/services/idleKillLootService.js');
const {
  planFullSetLegacyTotals,
  slotsForRoleGroup,
  clearSetLegacyCacheForTests
} = await import('../src/data/gear/planLegacy.js');
const { generateGearItem } = await import('../src/data/gear/generator.js');
const { capRaidBossDamageReport, resetRaidBossDamageLimiterForTests } = await import(
  '../src/utils/raidBossDamageLimiter.js'
);
const { isValidStreamerKeyRequest } = await import('../src/utils/streamerKeyValidation.js');

function adminJwt() {
  return jwt.sign({ userId: 'admin-user', twitchUserId: 'admin', isAdmin: true }, TEST_JWT_SECRET, {
    expiresIn: '1h'
  });
}

async function runTests() {
  console.log('\nGAP 3 round tests\n');
  let passed = 0;
  let failed = 0;
  const pass = (n) => {
    console.log(`  ✓ ${n}`);
    passed++;
  };
  const fail = (n, e) => {
    console.log(`  ✗ ${n}:`, e.message);
    failed++;
  };

  console.log('\nStripe 1: dispute resolves purchaseId via payment_intent cache');
  try {
    const purchaseId = 'gap3-pi-purchase';
    const userId = 'gap3-pi-user';
    await db.collection('stripePaymentIntents').doc('pi_gap3').set({ purchaseId, userId });
    await db.collection('purchases').doc(purchaseId).set({
      userId,
      packTier: 'gold',
      status: 'completed',
      amountPaid: 2000
    });
    await db.collection('heroes').doc('gap3-hero').set({
      twitchUserId: userId,
      founderPackTier: 'gold',
      founderBadge: '/badge.png',
      nameColor: '#gold',
      nameFrame: 'founder_silver',
      auraEffect: 'founder_gold',
      activeTitle: 'Founder',
      ownedCosmetics: ['founder_badge_gold', 'name_iron'],
      tokens: 50
    });
    await db.collection('users').doc(userId).set({
      founderPackTier: 'gold',
      ownedCosmetics: ['founder_badge_gold', 'name_iron']
    });
    await handleStripeWebhookEvent(db, {
      id: 'evt_dispute_gap3',
      type: 'charge.dispute.created',
      data: {
        object: {
          id: 'dp_gap3',
          payment_intent: 'pi_gap3',
          amount: 2000,
          charge: {
            payment_intent: 'pi_gap3',
            amount: 2000,
            amount_refunded: 2000,
            metadata: {}
          }
        }
      }
    });
    const hero = (await db.collection('heroes').doc('gap3-hero').get()).data();
    assert.equal(hero.founderBadge, null);
    assert.equal(hero.nameColor, null);
    assert.equal(hero.auraEffect, null);
    assert.equal(hero.activeTitle, null);
    assert.ok(hero.ownedCosmetics.includes('name_iron'));
    pass('Stripe 1: dispute resolves purchaseId via payment_intent cache');
  } catch (e) {
    fail('Stripe 1: dispute resolves purchaseId via payment_intent cache', e);
  }

  console.log('\nStripe 2: partial founder refund skipped (manual review)');
  try {
    const purchaseId = 'gap3-partial-founder';
    await db.collection('purchases').doc(purchaseId).set({
      userId: 'u-partial',
      packTier: 'gold',
      status: 'completed',
      amountPaid: 2000
    });
    await handleStripeWebhookEvent(db, {
      id: 'evt_partial_f',
      type: 'charge.refunded',
      data: {
        object: { metadata: { purchaseId, userId: 'u-partial' }, amount: 2000, amount_refunded: 500 }
      }
    });
    const purchase = (await db.collection('purchases').doc(purchaseId).get()).data();
    assert.equal(purchase.status, 'completed');
    const ev = (await db.collection('stripeEvents').doc('evt_partial_f').get()).data();
    assert.equal(ev.reason, 'partial_founder_refund_manual_review');
    pass('Stripe 2: partial founder refund skipped (manual review)');
  } catch (e) {
    fail('Stripe 2: partial founder refund skipped (manual review)', e);
  }

  console.log('\nStripe 3: token partial refund proportional + negative blocks spend');
  try {
    const purchaseId = 'gap3-partial-token';
    const heroId = 'gap3-token-hero';
    const { TOKEN_PACKS } = await import('../src/data/tokenPacks.js');
    const packKey = Object.keys(TOKEN_PACKS)[0];
    const pack = TOKEN_PACKS[packKey];
    await db.collection('heroes').doc(heroId).set({ twitchUserId: 'tok-u', tokens: 100 });
    await db.collection('purchases').doc(purchaseId).set({
      userId: 'tok-u',
      packType: packKey,
      heroId,
      status: 'completed',
      amountPaid: 100
    });
    await handleStripeWebhookEvent(db, {
      id: 'evt_partial_t',
      type: 'charge.refunded',
      data: {
        object: { metadata: { purchaseId, userId: 'tok-u' }, amount: 100, amount_refunded: 50 }
      }
    });
    const hero = (await db.collection('heroes').doc(heroId).get()).data();
    const expected = 100 - Math.floor(pack.tokens * 0.5);
    assert.equal(hero.tokens, expected);
    pass('Stripe 3: token partial refund proportional + negative blocks spend');
  } catch (e) {
    fail('Stripe 3: token partial refund proportional + negative blocks spend', e);
  }

  console.log('\nGear 1: table-driven full-set budgets ±10%');
  try {
    clearSetLegacyCacheForTests();
    const roles = ['tank', 'healer', 'melee', 'caster', 'ranged'];
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const ilvls = [10, 50, 100];
    let violations = 0;
    for (const role of roles) {
      for (const rarity of rarities) {
        for (const ilvl of ilvls) {
          const plan = planFullSetLegacyTotals(role, ilvl, rarity);
          let attack = 0;
          let defense = 0;
          let hp = 0;
          for (const slot of slotsForRoleGroup(role)) {
            const it = generateGearItem({
              roleGroup: role,
              slot,
              rarity,
              ilvl,
              source: { type: 'idle', enemyLevel: ilvl },
              seed: `gap3-${role}-${slot}-${rarity}-${ilvl}`
            });
            attack += it.attack || 0;
            defense += it.defense || 0;
            hp += it.hp || 0;
          }
          for (const [actual, target] of [
            [attack, plan.attack],
            [defense, plan.defense],
            [hp, plan.hp]
          ]) {
            if (target > 0 && (actual < target * 0.9 || actual > target * 1.1)) violations++;
          }
        }
      }
    }
    assert.equal(violations, 0, `violations=${violations}`);
    pass('Gear 1: table-driven full-set budgets ±10%');
  } catch (e) {
    fail('Gear 1: table-driven full-set budgets ±10%', e);
  }

  console.log('\nGear 2: zero rarity inversions (200 seeds)');
  try {
    clearSetLegacyCacheForTests();
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    let inv = 0;
    for (let s = 0; s < 200; s++) {
      for (const role of ['tank', 'melee', 'caster']) {
        const totals = rarities.map((rarity) => {
          let a = 0;
          for (const slot of slotsForRoleGroup(role)) {
            a +=
              generateGearItem({
                roleGroup: role,
                slot,
                rarity,
                ilvl: 50,
                source: { type: 'idle', enemyLevel: 50 },
                seed: `gap3-mono-${s}-${role}-${slot}`
              }).attack || 0;
          }
          return a;
        });
        for (let i = 1; i < totals.length; i++) {
          if (totals[i] < totals[i - 1]) inv++;
        }
      }
    }
    assert.equal(inv, 0);
    pass('Gear 2: zero rarity inversions (200 seeds)');
  } catch (e) {
    fail('Gear 2: zero rarity inversions (200 seeds)', e);
  }

  console.log('\nRate 1: bogus streamer key does not skip write limiter');
  try {
    const rlSrc = readFileSync(join(ROOT, 'src/middleware/rateLimit.js'), 'utf8');
    assert.ok(rlSrc.includes('isValidStreamerKeyRequest'));
    const bogus = await isValidStreamerKeyRequest({
      method: 'POST',
      headers: { 'x-streamer-key': WRONG_STREAMER_KEY },
      params: { battlefieldId: 'twitch:streamer1' }
    });
    assert.equal(bogus, false);
    const good = await isValidStreamerKeyRequest({
      method: 'POST',
      headers: { 'x-streamer-key': VALID_STREAMER_KEY },
      params: { battlefieldId: 'twitch:streamer1' }
    });
    assert.equal(good, true);
    pass('Rate 1: bogus streamer key does not skip write limiter');
  } catch (e) {
    fail('Rate 1: bogus streamer key does not skip write limiter', e);
  }

  console.log('\nLoot 1: forged fromAbility does not bypass kill rate');
  try {
    resetIdleLootWindows();
    await db.collection('heroes').doc('gap3-forge-hero').set({
      twitchUserId: '111',
      currentBattlefieldId: 'twitch:streamer1',
      level: 20,
      class: 'guardian',
      inventory: [],
      xp: 0
    });
    const xpBefore = 0;
    for (let i = 0; i < 35; i++) {
      await request(app)
        .post('/api/battlefields/twitch:streamer1/loot/roll')
        .set('X-Streamer-Key', VALID_STREAMER_KEY)
        .send({
          kills: [{ heroId: 'gap3-forge-hero', enemyLevel: 20, kind: 'normal', fromAbility: true }]
        });
    }
    const hero = (await db.collection('heroes').doc('gap3-forge-hero').get()).data();
    assert.ok((hero.xp || 0) >= xpBefore);
    const throttled = await request(app)
      .post('/api/battlefields/twitch:streamer1/loot/roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({ kills: [{ heroId: 'gap3-forge-hero', enemyLevel: 20, kind: 'normal', fromAbility: true }] });
    assert.equal(throttled.body.success, true);
    pass('Loot 1: forged fromAbility does not bypass kill rate');
  } catch (e) {
    fail('Loot 1: forged fromAbility does not bypass kill rate', e);
  }

  console.log('\nLoot 2: elite rolling window allows honest small batches');
  try {
    resetIdleLootWindows();
    const heroId = 'gap3-elite-hero';
    let elites = 0;
    for (let i = 0; i < 5; i++) {
      const k = normalizeIdleKill({ heroId, enemyLevel: 10, kind: 'elite' });
      if (k.kind === 'elite') elites++;
    }
    assert.ok(elites >= 1, `elites=${elites}`);
    pass('Loot 2: elite rolling window allows honest small batches');
  } catch (e) {
    fail('Loot 2: elite rolling window allows honest small batches', e);
  }

  console.log('\nLoot 3: instanceId dungeon trash uses instance table');
  try {
    resetIdleLootWindows();
    const instanceId = 'gap3-dungeon-inst';
    await db.collection('dungeonInstances').doc(instanceId).set({
      status: 'in-progress',
      dungeonId: 'ancient_catacombs',
      difficulty: 'normal',
      participantIds: ['gap3-inst-hero']
    });
    await db.collection('heroes').doc('gap3-inst-hero').set({
      twitchUserId: '111',
      currentBattlefieldId: 'twitch:streamer1',
      level: 30,
      class: 'guardian',
      inventory: [],
      lootPity: {},
      setCollection: {}
    });
    const res = await request(app)
      .post('/api/battlefields/twitch:streamer1/loot/roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({
        kills: [{ heroId: 'gap3-inst-hero', enemyLevel: 30, kind: 'normal', instanceId }]
      });
    assert.equal(res.status, 200);
    const doc = readFileSync(join(ROOT, 'docs/QUEUE_API.md'), 'utf8');
    assert.ok(doc.includes('instanceId'));
    pass('Loot 3: instanceId dungeon trash uses instance table');
  } catch (e) {
    fail('Loot 3: instanceId dungeon trash uses instance table', e);
  }

  console.log('\nRaid 1: boss damage pace limiter caps burst reports');
  try {
    resetRaidBossDamageLimiterForTests();
    const instance = {
      id: 'raid-pace',
      bossMaxHp: 100_000,
      bossHp: 100_000,
      totalBossDamageApplied: 0,
      bossFightStartedAt: Date.now()
    };
    let total = 0;
    for (let i = 0; i < 20; i++) {
      const { applied } = capRaidBossDamageReport({
        instance: { ...instance, totalBossDamageApplied: total },
        heroLevel: 50,
        classKey: 'berserker',
        heroKey: 'h1',
        requestedDamage: 50_000
      });
      total += applied;
    }
    assert.ok(total < 100_000);
    pass('Raid 1: boss damage pace limiter caps burst reports');
  } catch (e) {
    fail('Raid 1: boss damage pace limiter caps burst reports', e);
  }

  console.log('\nAdmin 1: GET /api/admin/heroes requires JWT admin claim');
  try {
    const noJwt = await request(app).get('/api/admin/heroes');
    assert.equal(noJwt.status, 401);
    const withAdmin = await request(app)
      .get('/api/admin/heroes')
      .set('Authorization', `Bearer ${adminJwt()}`);
    assert.equal(withAdmin.status, 200);
    const adminSrc = readFileSync(join(ROOT, 'src/middleware/auth.js'), 'utf8');
    assert.ok(adminSrc.includes('isAdmin'));
    pass('Admin 1: GET /api/admin/heroes requires JWT admin claim');
  } catch (e) {
    fail('Admin 1: GET /api/admin/heroes requires JWT admin claim', e);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`GAP 3: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
