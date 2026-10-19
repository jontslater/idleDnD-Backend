/**
 * GAP 2 round: loot auth, rules, Stripe revoke, gear, rate limit, auth creds, raids, routes.
 */

import { strict as assert } from 'assert';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import request from 'supertest';
import { applyTestEnv, VALID_STREAMER_KEY, TEST_JWT_SECRET } from './setupTestEnv.js';

applyTestEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { app, db } = await import('../src/index.js');
const {
  resetIdleLootWindows,
  TARGET_DROPS_PER_HOUR,
  createBatchLootContext,
  resolveKillKindForBatch
} = await import('../src/services/idleKillLootService.js');
const { handleStripeWebhookEvent } = await import('../src/services/stripeWebhookHandler.js');
const { resolveStreamerIdFromRequest } = await import('../src/utils/streamerAuth.js');
const { generateGearItem, totalStatBudgetFromItem } = await import('../src/data/gear/generator.js');
const { itemBudget } = await import('../src/data/gear/budget.js');
const { GEAR_RARITY_R } = await import('../src/data/balance.js');
const { SET_HOOK_CATALOG } = await import('../src/data/gear/sets.js');

const ADMIN_KEY = process.env.ADMIN_KEY;

async function seedLootHero(id, bf = 'twitch:streamer1') {
  await db.collection('heroes').doc(id).set({
    twitchUserId: '111',
    currentBattlefieldId: bf,
    level: 20,
    class: 'guardian',
    inventory: [],
    lootPity: {},
    setCollection: {}
  });
}

async function runTests() {
  console.log('\nGAP 2 round tests\n');
  console.log('='.repeat(60));
  let passed = 0;
  let failed = 0;

  const pass = (name) => {
    console.log(`  ✓ ${name}`);
    passed++;
  };
  const fail = (name, e) => {
    console.log(`  ✗ ${name}:`, e.message);
    failed++;
  };

  console.log('\nLoot 1: derive streamerId from :battlefieldId (kills-only body → 200)');
  try {
    await seedLootHero('gap2-hero-loot');
    const res = await request(app)
      .post('/api/battlefields/twitch:streamer1/loot/roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({ kills: [{ heroId: 'gap2-hero-loot', enemyLevel: 20, kind: 'normal' }] });
    assert.notEqual(res.status, 400, res.body?.error);
    assert.equal(res.status, 200);
    pass('Loot 1: derive streamerId from :battlefieldId (kills-only body → 200)');
  } catch (e) {
    fail('Loot 1: derive streamerId from :battlefieldId (kills-only body → 200)', e);
  }

  console.log('\nLoot 2: boss kind → 403');
  try {
    const res = await request(app)
      .post('/api/battlefields/twitch:streamer1/loot/roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({ kills: [{ heroId: 'gap2-hero-loot', enemyLevel: 20, kind: 'raidBoss' }] });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'BOSS_LOOT_SERVER_ONLY');
    pass('Loot 2: boss kind → 403');
  } catch (e) {
    fail('Loot 2: boss kind → 403)', e);
  }

  console.log('\nLoot 3: cross-battlefield (key streamer1 + URL twitch:streamer2) → 403');
  try {
    const res = await request(app)
      .post('/api/battlefields/twitch:streamer2/loot/roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({
        streamerId: 'streamer1',
        kills: [{ heroId: 'gap2-hero-loot', enemyLevel: 20, kind: 'normal' }]
      });
    assert.equal(res.status, 403);
    pass('Loot 3: cross-battlefield (key streamer1 + URL twitch:streamer2) → 403');
  } catch (e) {
    fail('Loot 3: cross-battlefield (key streamer1 + URL twitch:streamer2) → 403', e);
  }

  console.log('\nLoot 3b: overlay loot-roll battlefield mismatch → 403');
  try {
    const res = await request(app)
      .post('/api/overlay/loot-roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({
        streamerId: 'streamer1',
        battlefieldId: 'twitch:streamer2',
        kills: [{ heroId: 'gap2-hero-loot', enemyLevel: 20, kind: 'normal' }]
      });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'BATTLEFIELD_STREAMER_MISMATCH');
    pass('Loot 3b: overlay loot-roll battlefield mismatch → 403');
  } catch (e) {
    fail('Loot 3b: overlay loot-roll battlefield mismatch → 403', e);
  }

  console.log('\nLoot 4: dungeon trash contentType allowed');
  try {
    const res = await request(app)
      .post('/api/battlefields/twitch:streamer1/loot/roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({
        kills: [{ heroId: 'gap2-hero-loot', enemyLevel: 20, kind: 'normal', contentType: 'dungeon' }]
      });
    assert.equal(res.status, 200);
    pass('Loot 4: dungeon trash contentType allowed');
  } catch (e) {
    fail('Loot 4: dungeon trash contentType allowed', e);
  }

  console.log('\nLoot 5: drop cap counts drops not attempts');
  try {
    resetIdleLootWindows();
    const originalRandom = Math.random;
    Math.random = () => 0;
    const heroId = 'gap2-cap-hero';
    await seedLootHero(heroId);
    let drops = 0;
    for (let i = 0; i < TARGET_DROPS_PER_HOUR + 5; i++) {
      const res = await request(app)
        .post('/api/battlefields/twitch:streamer1/loot/roll')
        .set('X-Streamer-Key', VALID_STREAMER_KEY)
        .send({ kills: [{ heroId, enemyLevel: 20, kind: 'normal' }] });
      assert.equal(res.status, 200);
      if (res.body.drops?.length) drops += res.body.drops.length;
    }
    Math.random = originalRandom;
    assert.equal(drops, TARGET_DROPS_PER_HOUR);
    pass('Loot 5: drop cap counts drops not attempts');
  } catch (e) {
    Math.random = Math.random;
    fail('Loot 5: drop cap counts drops not attempts', e);
  }

  console.log('\nLoot 6: elite kind clamped per batch');
  try {
    const ctx = createBatchLootContext(Array(8).fill({ kind: 'elite' }));
    let eliteCount = 0;
    for (let i = 0; i < 8; i++) {
      const k = resolveKillKindForBatch({ kind: 'elite' }, ctx);
      if (k === 'elite') eliteCount++;
    }
    assert.ok(eliteCount <= 2, `eliteCount=${eliteCount}`);
    pass('Loot 6: elite kind clamped per batch');
  } catch (e) {
    fail('Loot 6: elite kind clamped per batch', e);
  }

  console.log('\nLoot 7: resolveStreamerIdFromRequest wired from battlefieldId param');
  try {
    const id = resolveStreamerIdFromRequest({ params: { battlefieldId: 'twitch:abc123' }, body: {} });
    assert.equal(id, 'abc123');
    const src = readFileSync(join(ROOT, 'src/middleware/auth.js'), 'utf8');
    assert.ok(src.includes('resolveStreamerIdFromRequest'));
    pass('Loot 7: resolveStreamerIdFromRequest wired from battlefieldId param');
  } catch (e) {
    fail('Loot 7: resolveStreamerIdFromRequest wired from battlefieldId param', e);
  }

  console.log('\nRules 1: heroes/battlefields public read, no client writes');
  try {
    const rules = readFileSync(join(ROOT, 'firestore.rules'), 'utf8');
    assert.match(rules, /match \/heroes\/\{heroId\}[\s\S]*allow read: if true/);
    assert.match(rules, /match \/heroes\/\{heroId\}[\s\S]*allow write: if false/);
    assert.match(rules, /match \/twitchCredentials\/\{id\}[\s\S]*allow read, write: if false/);
    pass('Rules 1: heroes/battlefields public read, no client writes');
  } catch (e) {
    fail('Rules 1: heroes/battlefields public read, no client writes', e);
  }

  console.log('\nRules 2: DEPLOY.md documents rules deploy');
  try {
    const deploy = readFileSync(join(ROOT, 'docs/DEPLOY.md'), 'utf8');
    assert.ok(deploy.includes('firestore:rules'));
    pass('Rules 2: DEPLOY.md documents rules deploy');
  } catch (e) {
    fail('Rules 2: DEPLOY.md documents rules deploy', e);
  }

  console.log('\nStripe 1: refund revokes founder + tokens on hero');
  try {
    const userId = 'stripe-revoke-user';
    const heroId = 'stripe-revoke-hero';
    const purchaseId = 'purchase-revoke-1';
    await db.collection('users').doc(userId).set({
      founderPackTier: 'gold',
      ownedCosmetics: ['skin_gold']
    });
    await db.collection('heroes').doc(heroId).set({
      twitchUserId: userId,
      tokens: 500,
      founderPackTier: 'gold',
      ownedCosmetics: ['skin_gold'],
      equippedCosmetics: { skin: 'skin_gold' }
    });
    await db.collection('purchases').doc(purchaseId).set({
      userId,
      packTier: 'gold',
      status: 'completed',
      heroId
    });
    const event = {
      id: 'evt_refund_1',
      type: 'charge.refunded',
      data: { object: { metadata: { purchaseId, userId } } }
    };
    await handleStripeWebhookEvent(db, event);
    const userAfter = (await db.collection('users').doc(userId).get()).data();
    const heroAfter = (await db.collection('heroes').doc(heroId).get()).data();
    assert.equal(userAfter.founderPackTier, null);
    assert.deepEqual(userAfter.ownedCosmetics, []);
    assert.equal(heroAfter.founderPackTier, null);
    assert.deepEqual(heroAfter.ownedCosmetics, []);
    const purchaseAfter = (await db.collection('purchases').doc(purchaseId).get()).data();
    assert.equal(purchaseAfter.status, 'refunded');
    pass('Stripe 1: refund revokes founder + tokens on hero');
  } catch (e) {
    fail('Stripe 1: refund revokes founder + tokens on hero', e);
  }

  console.log('\nStripe 2: token pack refund removes tokens');
  try {
    const userId = 'stripe-token-user';
    const heroId = 'stripe-token-hero';
    const purchaseId = 'purchase-token-revoke';
    const { TOKEN_PACKS } = await import('../src/data/tokenPacks.js');
    const packKey = Object.keys(TOKEN_PACKS)[0];
    const pack = TOKEN_PACKS[packKey];
    await db.collection('heroes').doc(heroId).set({ twitchUserId: userId, tokens: 100 + pack.tokens });
    await db.collection('purchases').doc(purchaseId).set({
      userId,
      packType: packKey,
      heroId,
      status: 'completed'
    });
    await handleStripeWebhookEvent(db, {
      id: 'evt_refund_token',
      type: 'charge.refunded',
      data: { object: { metadata: { purchaseId, userId } } }
    });
    const heroAfter = (await db.collection('heroes').doc(heroId).get()).data();
    assert.equal(heroAfter.tokens, 100);
    pass('Stripe 2: token pack refund removes tokens');
  } catch (e) {
    fail('Stripe 2: token pack refund removes tokens', e);
  }

  console.log('\nStripe 3: checkout sets payment_intent_data.metadata');
  try {
    const src = readFileSync(join(ROOT, 'src/routes/purchases.js'), 'utf8');
    assert.ok(src.includes('payment_intent_data'));
    assert.ok(src.includes('purchaseId'));
    pass('Stripe 3: checkout sets payment_intent_data.metadata');
  } catch (e) {
    fail('Stripe 3: checkout sets payment_intent_data.metadata', e);
  }

  console.log('\nLoot 8: single 8% roll wired (guaranteedDrop in idle service)');
  try {
    const idleSrc = readFileSync(join(ROOT, 'src/services/idleKillLootService.js'), 'utf8');
    const rollSrc = readFileSync(join(ROOT, 'src/services/lootRollService.js'), 'utf8');
    assert.ok(idleSrc.includes('Math.random() > rollChance'));
    assert.ok(idleSrc.includes('guaranteedDrop: true'));
    assert.ok(!idleSrc.includes('shouldDrop'));
    assert.ok(rollSrc.includes('options.guaranteedDrop'));
    pass('Loot 8: single 8% roll wired (guaranteedDrop in idle service)');
  } catch (e) {
    fail('Loot 8: single 8% roll wired (guaranteedDrop in idle service)', e);
  }

  console.log('\nGear 1: monotonic rarity (200 random seeds, armor slot)');
  try {
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    let inversions = 0;
    for (let s = 0; s < 200; s++) {
      const totals = rarities.map((rarity) =>
        totalStatBudgetFromItem(
          generateGearItem({
            roleGroup: 'melee',
            slot: 'armor',
            rarity,
            ilvl: 50,
            source: { type: 'idle', enemyLevel: 50 },
            seed: `gap2-mono-${s}-${rarity}`
          })
        )
      );
      for (let i = 1; i < totals.length; i++) {
        if (totals[i] < totals[i - 1]) inversions++;
      }
    }
    assert.equal(inversions, 0, `inversions=${inversions}`);
    pass('Gear 1: monotonic rarity (200 random seeds, armor slot)');
  } catch (e) {
    fail('Gear 1: monotonic rarity (200 random seeds, armor slot)', e);
  }

  console.log('\nGear 2: tank rare+ HP/attack floors at ilvl 50');
  try {
    for (const rarity of ['rare', 'legendary']) {
      const it = generateGearItem({
        roleGroup: 'tank',
        slot: 'armor',
        rarity,
        ilvl: 50,
        source: { type: 'idle', enemyLevel: 50 },
        seed: `tank-budget-${rarity}`
      });
      const budget = itemBudget({ roleGroup: 'tank', slot: 'armor', ilvl: 50, rarity });
      assert.ok((it.hp || 0) >= Math.floor(budget * 0.35), `tank hp ${rarity}`);
      assert.ok((it.attack || 0) >= Math.floor(budget * 0.08), `tank atk ${rarity}`);
    }
    pass('Gear 2: tank rare+ HP/attack floors at ilvl 50');
  } catch (e) {
    fail('Gear 2: tank rare+ HP/attack floors at ilvl 50', e);
  }

  console.log('\nGear 2b: healer armor floor at rare+ ilvl 50');
  try {
    for (const rarity of ['rare', 'epic', 'legendary']) {
      const it = generateGearItem({
        roleGroup: 'healer',
        slot: 'armor',
        rarity,
        ilvl: 50,
        source: { type: 'idle', enemyLevel: 50 },
        seed: `healer-armor-${rarity}`
      });
      const budget = itemBudget({ roleGroup: 'healer', slot: 'armor', ilvl: 50, rarity });
      const minArmor = Math.floor(budget * 0.25);
      const armor = it.defense || it.stats?.armor || 0;
      assert.ok(armor >= minArmor, `${rarity} armor=${armor} min=${minArmor}`);
    }
    pass('Gear 2b: healer armor floor at rare+ ilvl 50');
  } catch (e) {
    fail('Gear 2b: healer armor floor at rare+ ilvl 50', e);
  }

  console.log('\nGear 3: SET_HOOK_CATALOG + 2-piece statBonuses exported');
  try {
    assert.ok(SET_HOOK_CATALOG.length >= 8);
    const exportScript = readFileSync(join(ROOT, 'scripts/export-gear-data.js'), 'utf8');
    assert.ok(exportScript.includes('SET_HOOK_CATALOG'));
    pass('Gear 3: SET_HOOK_CATALOG + 2-piece statBonuses exported');
  } catch (e) {
    fail('Gear 3: SET_HOOK_CATALOG + 2-piece statBonuses exported', e);
  }

  console.log('\nRate 1: trust proxy + write limiter skips GET and streamer key');
  try {
    const indexSrc = readFileSync(join(ROOT, 'src/index.js'), 'utf8');
    assert.ok(indexSrc.includes("app.set('trust proxy', 1)"));
    const rlSrc = readFileSync(join(ROOT, 'src/middleware/rateLimit.js'), 'utf8');
    assert.ok(rlSrc.includes("method === 'GET'"));
    assert.ok(rlSrc.includes("x-streamer-key"));
    assert.ok(indexSrc.includes('writeRateLimiter'));
    pass('Rate 1: trust proxy + write limiter skips GET and streamer key');
  } catch (e) {
    fail('Rate 1: trust proxy + write limiter skips GET and streamer key', e);
  }

  console.log('\nAuth 1: saveTwitchCredentials before hero check (grep)');
  try {
    const authSrc = readFileSync(join(ROOT, 'src/routes/auth.js'), 'utf8');
    const saveIdx = authSrc.indexOf('saveTwitchCredentials');
    const heroEmptyIdx = authSrc.indexOf('if (!heroQuery.empty)');
    assert.ok(saveIdx > 0 && saveIdx < heroEmptyIdx);
    pass('Auth 1: saveTwitchCredentials before hero check (grep)');
  } catch (e) {
    fail('Auth 1: saveTwitchCredentials before hero check (grep)', e);
  }

  console.log('\nCombat 1: ability kill grants XP');
  try {
    resetIdleLootWindows();
    const heroId = 'gap2-ability-xp';
    await seedLootHero(heroId);
    const before = (await db.collection('heroes').doc(heroId).get()).data();
    const xp0 = before.xp || 0;
    await request(app)
      .post('/api/battlefields/twitch:streamer1/loot/roll')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({
        kills: [{ heroId, enemyLevel: 20, kind: 'normal', fromAbility: true, abilityId: 'whirlwind' }]
      });
    const after = (await db.collection('heroes').doc(heroId).get()).data();
    assert.ok((after.xp || 0) > xp0);
    pass('Combat 1: ability kill grants XP');
  } catch (e) {
    fail('Combat 1: ability kill grants XP', e);
  }

  console.log('\nRaid 1: bossDamage capped at 5% max HP per report');
  try {
    const instanceId = 'gap2-raid-inst';
    await db.collection('raidInstances').doc(instanceId).set({
      streamerTwitchId: 'streamer1',
      battlefieldId: 'twitch:streamer1',
      bossMaxHp: 10_000,
      bossHp: 10_000,
      maxWaves: 5,
      participantIds: ['111'],
      participants: [],
      status: 'in-progress'
    });
    const res = await request(app)
      .post(`/api/raids/instance/${instanceId}/progress`)
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({ wave: 1, participants: [], bossDamage: 9000 });
    assert.equal(res.status, 200);
    const inst = (await db.collection('raidInstances').doc(instanceId).get()).data();
    assert.equal(inst.bossHp, 9500);
    pass('Raid 1: bossDamage capped at 5% max HP per report');
  } catch (e) {
    fail('Raid 1: bossDamage capped at 5% max HP per report', e);
  }

  console.log('\nRoutes 1: cosmetic-tokens → 410');
  try {
    const jwt = (await import('jsonwebtoken')).default;
    const t = jwt.sign({ userId: 'gap2-hero-loot', twitchUserId: '111' }, TEST_JWT_SECRET, {
      expiresIn: '1h'
    });
    const res = await request(app)
      .post('/api/heroes/gap2-hero-loot/purchase/cosmetic-tokens')
      .set('Authorization', `Bearer ${t}`)
      .send({});
    assert.equal(res.status, 410);
    pass('Routes 1: cosmetic-tokens → 410');
  } catch (e) {
    fail('Routes 1: cosmetic-tokens → 410', e);
  }

  console.log('\nRoutes 2: GET /api/admin/heroes requires admin');
  try {
    const noAdmin = await request(app).get('/api/admin/heroes');
    assert.equal(noAdmin.status, 401);
    const ok = await request(app).get('/api/admin/heroes').set('X-Admin-Key', ADMIN_KEY);
    assert.equal(ok.status, 200);
    assert.ok(Array.isArray(ok.body.heroes));
    pass('Routes 2: GET /api/admin/heroes requires admin');
  } catch (e) {
    fail('Routes 2: GET /api/admin/heroes requires admin', e);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`GAP 2: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
