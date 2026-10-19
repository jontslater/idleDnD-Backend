#!/usr/bin/env node
/**
 * Regenerate legacy inventory items to the new gear budget model.
 * Usage: node scripts/migrate-gear-v2.js [--dry-run] [--wipe]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateGearItem } from '../src/data/gear/generator.js';
import { roleGroupFromHero } from '../src/data/gear/roleGroup.js';
import { LEGACY_SET_MAP } from '../src/data/gear/sets.js';

const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const wipe = process.argv.includes('--wipe');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!admin.apps.length) {
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

function migrateItem(item, hero) {
  if (!item || !item.slot) return item;
  const ilvl = item.ilvl || item.level || hero.level || 1;
  const rarity = item.rarity || 'common';
  const roleGroup = roleGroupFromHero(hero);
  let setId = item.setId || null;
  if (item.setName) {
    const mapped = LEGACY_SET_MAP[item.setName.toLowerCase()];
    if (mapped) setId = mapped;
  }
  const regen = generateGearItem({
    roleGroup,
    slot: item.slot,
    rarity,
    ilvl,
    source: { type: 'idle', enemyLevel: ilvl },
    seed: `migrate-${item.id}`,
    setId,
    isSetPiece: Boolean(setId)
  });
  return {
    ...regen,
    id: item.id,
    name: item.name?.startsWith('Legacy') ? item.name : `Legacy ${item.name || regen.name}`,
    upgradeLevel: item.upgradeLevel,
    sockets: item.sockets
  };
}

async function run() {
  console.log(dryRun ? 'DRY RUN' : 'APPLY', wipe ? '(wipe inventories)' : '');
  const snap = await db.collection('heroes').get();
  let updated = 0;
  for (const doc of snap.docs) {
    const hero = doc.data();
    if (wipe) {
      if (!dryRun) await doc.ref.update({ inventory: [], equipment: {} });
      updated++;
      continue;
    }
    const inventory = (hero.inventory || []).map((it) => migrateItem(it, hero));
    const equipment = {};
    for (const [slot, it] of Object.entries(hero.equipment || {})) {
      if (it) equipment[slot] = migrateItem(it, hero);
    }
    if (!dryRun) {
      await doc.ref.update({ inventory, equipment, gearMigratedV2: true });
    }
    updated++;
  }
  console.log(`Processed ${updated} heroes`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
