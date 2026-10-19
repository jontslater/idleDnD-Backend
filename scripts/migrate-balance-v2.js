#!/usr/bin/env node
/**
 * Normalize hero economy fields to balance v2 (clamp gold/tokens, strip client-trusted flags).
 * Usage: node scripts/migrate-balance-v2.js [--dry-run] [--apply] [--wipe]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dryRun = !process.argv.includes('--apply');
const wipe = process.argv.includes('--wipe');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!admin.apps.length) {
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

function clamp(n, max = 50_000_000) {
  const v = Math.floor(Number(n) || 0);
  return Math.min(max, Math.max(0, v));
}

async function run() {
  console.log(dryRun ? 'DRY RUN' : 'APPLY', wipe ? '(wipe gold/tokens)' : '');
  const snap = await db.collection('heroes').get();
  let updated = 0;
  for (const doc of snap.docs) {
    const hero = doc.data();
    const patch = { balanceMigratedV2: true };
    if (wipe) {
      patch.gold = 0;
      patch.tokens = 0;
    } else {
      patch.gold = clamp(hero.gold);
      patch.tokens = clamp(hero.tokens, 1_000_000);
    }
    if (!dryRun) {
      await doc.ref.update(patch);
    }
    updated++;
  }
  console.log(`Processed ${updated} heroes`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
