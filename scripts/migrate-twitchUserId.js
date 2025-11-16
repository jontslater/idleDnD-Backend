/**
 * Migration: Normalize twitchUserId to string for all heroes.
 *
 * Usage (from IdleDnD-Backend root):
 *   node scripts/migrate-twitchUserId.js
 *
 * This will scan the heroes collection in batches and convert any numeric
 * twitchUserId field to a string.
 */

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

// Initialize Firebase Admin using serviceAccountKey.json (same as other scripts)
const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ serviceAccountKey.json not found. Expected at:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function migrateBatch(startAfterDoc = null) {
  const heroesRef = db.collection('heroes');

  let query = heroesRef.orderBy('__name__').limit(300);
  if (startAfterDoc) {
    query = query.startAfter(startAfterDoc);
  }

  const snapshot = await query.get();
  if (snapshot.empty) {
    console.log('No more documents to process in this batch.');
    return null;
  }

  let updates = 0;
  const batch = db.batch();

  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const twitchUserId = data.twitchUserId;

    if (typeof twitchUserId === 'number') {
      batch.update(doc.ref, { twitchUserId: String(twitchUserId) });
      updates++;
    }
  });

  if (updates > 0) {
    await batch.commit();
  }

  console.log(
    `Processed batch: ${snapshot.docs.length} docs | Converted: ${updates}`
  );

  return snapshot.docs[snapshot.docs.length - 1];
}

async function runMigration() {
  console.log('--- Starting twitchUserId normalization migration ---');

  let lastDoc = null;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    lastDoc = await migrateBatch(lastDoc);
    if (!lastDoc) break;
  }

  console.log('--- Migration complete. All twitchUserId values normalized to string. ---');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
