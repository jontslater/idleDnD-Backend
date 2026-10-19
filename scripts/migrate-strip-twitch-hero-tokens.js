#!/usr/bin/env node
/**
 * Remove legacy twitchAccessToken fields from all hero documents.
 * Usage: node scripts/migrate-strip-twitch-hero-tokens.js [--dry-run] [--apply]
 */
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const dryRun = !process.argv.includes('--apply');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');

if (!admin.apps.length) {
  const sa = JSON.parse(readFileSync(keyPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function run() {
  console.log(dryRun ? 'DRY RUN' : 'APPLY');
  const snap = await db.collection('heroes').get();
  let touched = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.twitchAccessToken || d.twitchRefreshToken || d.twitchTokenExpiresAt) {
      touched++;
      if (!dryRun) {
        await doc.ref.update({
          twitchAccessToken: admin.firestore.FieldValue.delete(),
          twitchRefreshToken: admin.firestore.FieldValue.delete(),
          twitchTokenExpiresAt: admin.firestore.FieldValue.delete()
        });
      }
    }
  }
  console.log(`Heroes with legacy token fields: ${touched}`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
