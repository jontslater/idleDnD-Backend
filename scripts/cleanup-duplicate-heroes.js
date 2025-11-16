/**
 * Cleanup duplicate heroes in Firestore.
 *
 * Strategy:
 *  - Group heroes by (twitchUserId, role).
 *  - Within each group, keep the "best" hero:
 *      1) Highest level
 *      2) If same level, highest (maxHp + attack + defense)
 *  - Delete all other heroes in that group.
 *
 * Usage (from IdleDnD-Backend):
 *   node scripts/cleanup-duplicate-heroes.js
 *
 * Requires:
 *   - serviceAccountKey.json in the backend root
 */

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

// Initialize Firebase Admin
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

function scoreHero(data) {
  const level = data.level || 0;
  const maxHp = data.maxHp || data.hp || 0;
  const attack = data.attack || 0;
  const defense = data.defense || 0;
  return {
    level,
    statScore: maxHp + attack + defense
  };
}

async function cleanupDuplicates() {
  console.log('🧹 Cleaning up duplicate heroes...');

  const snapshot = await db.collection('heroes').get();
  console.log(`📦 Loaded ${snapshot.size} hero documents`);

  // Group by twitchUserId + role
  const groups = new Map();

  snapshot.forEach(doc => {
    const data = doc.data();
    const twitchUserId = data.twitchUserId != null ? String(data.twitchUserId) : null;
    const role = data.role || 'UNKNOWN';

    if (!twitchUserId) {
      // Skip heroes without twitchUserId; we don't want to accidentally delete them
      return;
    }

    const key = `${twitchUserId}::${role}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key).push({
      docId: doc.id,
      twitchUserId,
      role,
      characterId: data.characterId || null,
      name: data.name || '',
      level: data.level || 0,
      maxHp: data.maxHp || data.hp || 0,
      attack: data.attack || 0,
      defense: data.defense || 0,
      raw: data
    });
  });

  const toDelete = [];

  for (const [key, heroes] of groups.entries()) {
    if (heroes.length <= 1) continue;

    // Only consider the specific users you pasted (safety)
    const sample = heroes[0];
    const allowedUsers = new Set([
      '638705915',   // AngelicDomi
      '90804916',    // CASTorDIE
      '52372248',    // Desertrose
      '535181549',   // FloodWater_
      '1295841915',  // GibsonTales
      '113627031',   // primovictoriadk
      '1291776881',  // SlimChungusGaming
      '146729989',   // tehchno
      '1087777297',  // theneverendingwar
      '67280849'     // TheSquishyOne
    ]);

    if (!allowedUsers.has(sample.twitchUserId)) {
      continue;
    }

    console.log('============================================================');
    console.log(`Group ${key} has ${heroes.length} heroes. Choosing best and deleting the rest.`);

    // Pick best hero
    let best = heroes[0];
    let bestScore = scoreHero(best.raw);

    for (let i = 1; i < heroes.length; i++) {
      const candidate = heroes[i];
      const candidateScore = scoreHero(candidate.raw);

      if (
        candidateScore.level > bestScore.level ||
        (candidateScore.level === bestScore.level &&
          candidateScore.statScore > bestScore.statScore)
      ) {
        best = candidate;
        bestScore = candidateScore;
      }
    }

    console.log(`  ✅ Keeping docId=${best.docId}, name=${best.name}, role=${best.role}, level=${best.level}, HP=${best.maxHp}, ATK=${best.attack}, DEF=${best.defense}`);

    // Mark others for deletion
    heroes.forEach(h => {
      if (h.docId === best.docId) return;
      console.log(`  🗑️  Deleting docId=${h.docId}, name=${h.name}, role=${h.role}, level=${h.level}, HP=${h.maxHp}, ATK=${h.attack}, DEF=${h.defense}`);
      toDelete.push(h.docId);
    });
  }

  if (toDelete.length === 0) {
    console.log('✅ No duplicates to delete (for the targeted users).');
    return;
  }

  console.log(`\n🚨 About to delete ${toDelete.length} hero documents.`);

  for (const docId of toDelete) {
    await db.collection('heroes').doc(docId).delete();
  }

  console.log('✅ Cleanup complete.');
}

cleanupDuplicates()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Error during cleanup:', err);
    process.exit(1);
  });
