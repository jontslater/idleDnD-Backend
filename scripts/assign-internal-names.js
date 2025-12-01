/**
 * Assign Internal Names to Existing Heroes
 * 
 * This script assigns internalName to all heroes in Firebase that don't have one.
 * Internal names follow the pattern: username, username2, username3, etc.
 * 
 * Strategy:
 *  - Group heroes by twitchUserId
 *  - Sort by joinedAt or lastActiveAt (oldest first)
 *  - Assign internalName sequentially: first hero = username, second = username2, etc.
 *  - Update heroes in Firebase
 *
 * Usage (from IdleDnD-Backend):
 *   node scripts/assign-internal-names.js
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

async function assignInternalNames() {
  console.log('📝 Assigning internal names to existing heroes...\n');

  const snapshot = await db.collection('heroes').get();
  console.log(`📦 Loaded ${snapshot.size} hero documents from Firebase\n`);

  if (snapshot.empty) {
    console.log('✅ No heroes found in Firebase.');
    return;
  }

  // Group heroes by twitchUserId
  const heroesByUserId = new Map();

  snapshot.forEach(doc => {
    const data = doc.data();
    const twitchUserId = data.twitchUserId != null ? String(data.twitchUserId) : null;
    const heroName = data.name || data.characterName || 'unknown';

    if (!twitchUserId) {
      // Skip heroes without twitchUserId
      console.log(`⚠️ Skipping hero ${heroName} (docId: ${doc.id}) - no twitchUserId`);
      return;
    }

    if (!heroesByUserId.has(twitchUserId)) {
      heroesByUserId.set(twitchUserId, []);
    }

    heroesByUserId.get(twitchUserId).push({
      docId: doc.id,
      twitchUserId,
      heroName,
      data: data,
      joinedAt: data.joinedAt || data.lastActiveAt || 0,
      lastActiveAt: data.lastActiveAt || data.joinedAt || 0
    });
  });

  console.log(`📊 Found heroes for ${heroesByUserId.size} unique users\n`);

  const toUpdate = [];
  let alreadyAssigned = 0;
  let needsAssignment = 0;

  // Process each user's heroes
  for (const [twitchUserId, heroes] of heroesByUserId.entries()) {
    // Sort heroes by creation time (oldest first) to maintain consistent ordering
    heroes.sort((a, b) => {
      // Primary sort: joinedAt (oldest first)
      if (a.joinedAt !== b.joinedAt) {
        return a.joinedAt - b.joinedAt;
      }
      // Secondary sort: lastActiveAt (oldest first)
      return a.lastActiveAt - b.lastActiveAt;
    });

    // Get username from first hero (should be consistent across heroes for same user)
    const username = heroes[0].heroName.toLowerCase().replace(/\s+/g, '');
    
    // Assign internalName sequentially
    heroes.forEach((hero, index) => {
      const existingInternalName = hero.data.internalName;
      
      if (existingInternalName) {
        // Already has internalName - check if it's correct
        const expectedInternalName = index === 0 ? username : `${username}${index + 1}`;
        if (existingInternalName === expectedInternalName) {
          alreadyAssigned++;
          return; // Already correct, skip
        } else {
          // Has internalName but it's wrong - update it
          console.log(`   ⚠️ Hero ${hero.heroName} (${hero.data.role}) has wrong internalName: "${existingInternalName}" (should be "${expectedInternalName}")`);
        }
      }

      // Assign internalName
      const internalName = index === 0 ? username : `${username}${index + 1}`;
      
      toUpdate.push({
        docId: hero.docId,
        heroName: hero.heroName,
        role: hero.data.role,
        level: hero.data.level || 1,
        oldInternalName: existingInternalName || '(none)',
        newInternalName: internalName
      });
      
      needsAssignment++;
    });
  }

  if (toUpdate.length === 0) {
    console.log(`✅ All heroes already have correct internal names assigned. (${alreadyAssigned} heroes checked)`);
    return;
  }

  console.log(`\n📋 Heroes needing internal name assignment: ${toUpdate.length}`);
  console.log(`   (${alreadyAssigned} heroes already have correct internal names)\n`);

  // Show preview of what will be updated
  console.log('Preview of updates:');
  console.log('='.repeat(80));
  
  // Group by user for cleaner output
  const updatesByUser = new Map();
  toUpdate.forEach(update => {
    const userId = snapshot.docs.find(d => d.id === update.docId)?.data()?.twitchUserId;
    if (!updatesByUser.has(userId)) {
      updatesByUser.set(userId, []);
    }
    updatesByUser.get(userId).push(update);
  });

  updatesByUser.forEach((updates, userId) => {
    const username = updates[0].heroName;
    console.log(`\nUser: ${username} (twitchUserId: ${userId})`);
    updates.forEach(update => {
      console.log(`  - ${update.heroName} (${update.role} Lv${update.level})`);
      console.log(`    ${update.oldInternalName} → ${update.newInternalName}`);
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log(`\n🚨 About to update ${toUpdate.length} hero documents in Firebase.`);

  // Ask for confirmation (in a real script, you might want to add a --yes flag)
  console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to proceed...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Update heroes in Firebase
  let updated = 0;
  let errors = 0;

  for (const update of toUpdate) {
    try {
      await db.collection('heroes').doc(update.docId).update({
        internalName: update.newInternalName
      });
      updated++;
      console.log(`   ✅ Updated ${update.heroName} (${update.role} Lv${update.level}): ${update.oldInternalName} → ${update.newInternalName}`);
    } catch (error) {
      errors++;
      console.error(`   ❌ Failed to update ${update.heroName} (docId: ${update.docId}):`, error.message);
    }
  }

  console.log(`\n✅ Assignment complete!`);
  console.log(`   - Updated: ${updated} heroes`);
  console.log(`   - Errors: ${errors} heroes`);
  console.log(`   - Already assigned correctly: ${alreadyAssigned} heroes`);
  console.log(`   - Total heroes processed: ${snapshot.size}`);
}

assignInternalNames()
  .then(() => {
    console.log('\n✅ Script complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error during script execution:', err);
    process.exit(1);
  });
