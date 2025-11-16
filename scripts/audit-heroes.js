/**
 * Audit all heroes in Firestore and print a summary grouped by twitchUserId.
 *
 * Usage (from IdleDnD-Backend):
 *   node scripts/audit-heroes.js
 *
 * Requires:
 *   - serviceAccountKey.json in the backend root (same as other scripts)
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

async function auditHeroes() {
  console.log('📊 Auditing heroes collection...');

  const snapshot = await db.collection('heroes').get();
  console.log(`📦 Found ${snapshot.size} hero documents\n`);

  // Group by twitchUserId (stringified) for analysis
  const groups = new Map(); // key: normalizedTwitchUserId, value: array of heroes

  snapshot.forEach(doc => {
    const data = doc.data();
    const twitchUserId = data.twitchUserId;
    const tiktokUserId = data.tiktokUserId;

    const normalizedTwitchId = twitchUserId != null ? String(twitchUserId) : null;
    const key = normalizedTwitchId || `NO_TWITCH_ID:${doc.id}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    const equipment = data.equipment || {};

    groups.get(key).push({
      docId: doc.id,
      twitchUserId: twitchUserId,
      twitchUserIdType: typeof twitchUserId,
      tiktokUserId: tiktokUserId,
      tiktokUserIdType: typeof tiktokUserId,
      characterId: data.characterId || null,
      name: data.name || '',
      role: data.role || '',
      level: data.level || 0,
      updatedAt: data.updatedAt ? data.updatedAt.toDate().toISOString() : null,
      hasSlots: {
        weapon: !!equipment.weapon,
        armor: !!equipment.armor,
        accessory: !!equipment.accessory,
        shield: !!equipment.shield,
        helm: !!equipment.helm,
        cloak: !!equipment.cloak,
        gloves: !!equipment.gloves,
        ring1: !!equipment.ring1,
        ring2: !!equipment.ring2,
        boots: !!equipment.boots
      }
    });
  });

  // Print grouped summary
  for (const [key, heroes] of groups.entries()) {
    const hasTwitchId = !key.startsWith('NO_TWITCH_ID:');
    const headerLabel = hasTwitchId ? `TwitchUserId = ${key}` : `NO twitchUserId (group key = ${key})`;

    console.log('============================================================');
    console.log(`👤 ${headerLabel} -> ${heroes.length} hero(s)`);

    // Highlight potential issues
    const twitchIdTypes = new Set(heroes.map(h => h.twitchUserIdType));
    if (twitchIdTypes.size > 1) {
      console.log('  ⚠️ Mixed twitchUserId types in this group:', Array.from(twitchIdTypes).join(', '));
    }

    heroes.forEach(h => {
      console.log(`  • docId: ${h.docId}`);
      console.log(`    - name: ${h.name}, role: ${h.role}, level: ${h.level}`);
      console.log(`    - characterId: ${h.characterId}`);
      console.log(`    - twitchUserId: ${h.twitchUserId} (type: ${h.twitchUserIdType})`);
      if (h.tiktokUserId) {
        console.log(`    - tiktokUserId: ${h.tiktokUserId} (type: ${h.tiktokUserIdType})`);
      }
      console.log(`    - updatedAt: ${h.updatedAt}`);
      console.log(
        `    - equipment slots:`,
        Object.entries(h.hasSlots)
          .filter(([_, has]) => has)
          .map(([slot]) => slot)
          .join(', ') || 'none'
      );
    });

    console.log('');
  }

  console.log('✅ Hero audit complete.');
}

auditHeroes().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error during audit:', err);
  process.exit(1);
});
