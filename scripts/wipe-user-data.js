/**
 * Admin Script: Wipe All User Data
 * 
 * This script completely deletes all data for a user, allowing them to start fresh.
 * 
 * Usage:
 *   node scripts/wipe-user-data.js <twitchUserId>
 * 
 * Example:
 *   node scripts/wipe-user-data.js 12345678
 *   node scripts/wipe-user-data.js "dingo dynasty"  (will search by username)
 * 
 * WARNING: This is IRREVERSIBLE. All user data will be permanently deleted.
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
try {
  const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.error('   Make sure serviceAccountKey.json exists in the backend root directory');
  process.exit(1);
}

const db = admin.firestore();

async function findUserByUsername(username) {
  console.log(`🔍 Searching for user by username: "${username}"...`);
  
  // Search in heroes collection
  const heroesSnapshot = await db.collection('heroes')
    .where('username', '==', username)
    .limit(1)
    .get();
  
  if (!heroesSnapshot.empty) {
    const hero = heroesSnapshot.docs[0].data();
    const twitchUserId = hero.twitchUserId || hero.twitchId;
    console.log(`✅ Found user! Twitch ID: ${twitchUserId} (type: ${typeof twitchUserId})`);
    return twitchUserId;
  }
  
  console.log(`❌ No user found with username "${username}"`);
  return null;
}

async function deleteAllUserData(twitchUserId) {
  console.log(`\n🗑️  Starting data wipe for Twitch ID: ${twitchUserId} (type: ${typeof twitchUserId})`);
  console.log(`⚠️  WARNING: This will permanently delete ALL data for this user!\n`);
  
  const results = {
    heroes: { deleted: 0, errors: [] },
    users: { deleted: 0, errors: [] },
    purchases: { deleted: 0, errors: [] }
  };
  
  // Try both string and number formats
  const userIdVariants = [
    twitchUserId,
    typeof twitchUserId === 'string' && /^\d+$/.test(twitchUserId) ? parseInt(twitchUserId, 10) : null
  ].filter(Boolean);
  
  // Also try legacy field names
  const fieldVariants = ['twitchUserId', 'twitchId'];
  
  // 1. Delete Heroes
  console.log('📦 Deleting heroes...');
  for (const userId of userIdVariants) {
    for (const field of fieldVariants) {
      try {
        const heroesSnapshot = await db.collection('heroes')
          .where(field, '==', userId)
          .get();
        
        if (!heroesSnapshot.empty) {
          console.log(`   Found ${heroesSnapshot.size} hero(es) with ${field} = ${userId}`);
          
          const deletePromises = heroesSnapshot.docs.map(async (doc) => {
            try {
              // Check if hero is in a battlefield
              const heroData = doc.data();
              if (heroData.currentBattlefieldId) {
                console.log(`   ⚠️  Hero ${doc.id} is in battlefield ${heroData.currentBattlefieldId} - removing from battlefield first...`);
                // Remove from battlefield
                const battlefieldRef = db.collection('battlefields').doc(heroData.currentBattlefieldId);
                const battlefieldDoc = await battlefieldRef.get();
                if (battlefieldDoc.exists) {
                  const battlefield = battlefieldDoc.data();
                  if (battlefield.heroes && Array.isArray(battlefield.heroes)) {
                    const updatedHeroes = battlefield.heroes.filter(h => h.id !== doc.id && h.userId !== userId);
                    await battlefieldRef.update({ heroes: updatedHeroes });
                    console.log(`   ✅ Removed hero from battlefield`);
                  }
                }
              }
              
              await doc.ref.delete();
              results.heroes.deleted++;
              console.log(`   ✅ Deleted hero: ${doc.id} (${heroData.name || 'unnamed'})`);
            } catch (error) {
              results.heroes.errors.push({ heroId: doc.id, error: error.message });
              console.log(`   ❌ Error deleting hero ${doc.id}: ${error.message}`);
            }
          });
          
          await Promise.all(deletePromises);
        }
      } catch (error) {
        console.log(`   ⚠️  Error querying heroes with ${field} = ${userId}: ${error.message}`);
      }
    }
  }
  
  // 2. Delete User Document
  console.log('\n👤 Deleting user document...');
  for (const userId of userIdVariants) {
    try {
      const userRef = db.collection('users').doc(String(userId));
      const userDoc = await userRef.get();
      
      if (userDoc.exists) {
        await userRef.delete();
        results.users.deleted++;
        console.log(`   ✅ Deleted user document: ${userId}`);
      } else {
        // Try with number format if string didn't work
        if (typeof userId === 'string') {
          const numericRef = db.collection('users').doc(String(parseInt(userId, 10)));
          const numericDoc = await numericRef.get();
          if (numericDoc.exists) {
            await numericRef.delete();
            results.users.deleted++;
            console.log(`   ✅ Deleted user document (numeric): ${userId}`);
          }
        }
      }
    } catch (error) {
      results.users.errors.push({ userId, error: error.message });
      console.log(`   ❌ Error deleting user document ${userId}: ${error.message}`);
    }
  }
  
  // 3. Delete Purchases (optional - commented out by default)
  console.log('\n💳 Checking purchases...');
  const DELETE_PURCHASES = process.env.DELETE_PURCHASES === 'true'; // Set env var to enable
  
  if (DELETE_PURCHASES) {
    for (const userId of userIdVariants) {
      for (const field of fieldVariants) {
        try {
          const purchasesSnapshot = await db.collection('purchases')
            .where(field, '==', userId)
            .get();
          
          if (!purchasesSnapshot.empty) {
            console.log(`   Found ${purchasesSnapshot.size} purchase(s) with ${field} = ${userId}`);
            
            const deletePromises = purchasesSnapshot.docs.map(async (doc) => {
              try {
                await doc.ref.delete();
                results.purchases.deleted++;
                console.log(`   ✅ Deleted purchase: ${doc.id}`);
              } catch (error) {
                results.purchases.errors.push({ purchaseId: doc.id, error: error.message });
                console.log(`   ❌ Error deleting purchase ${doc.id}: ${error.message}`);
              }
            });
            
            await Promise.all(deletePromises);
          }
        } catch (error) {
          console.log(`   ⚠️  Error querying purchases with ${field} = ${userId}: ${error.message}`);
        }
      }
    }
  } else {
    console.log('   ℹ️  Purchase deletion skipped (set DELETE_PURCHASES=true to enable)');
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 DELETION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Heroes deleted:    ${results.heroes.deleted}`);
  console.log(`User docs deleted: ${results.users.deleted}`);
  console.log(`Purchases deleted: ${results.purchases.deleted}`);
  
  if (results.heroes.errors.length > 0 || results.users.errors.length > 0 || results.purchases.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.heroes.errors.forEach(err => console.log(`   Hero ${err.heroId}: ${err.error}`));
    results.users.errors.forEach(err => console.log(`   User ${err.userId}: ${err.error}`));
    results.purchases.errors.forEach(err => console.log(`   Purchase ${err.purchaseId}: ${err.error}`));
  }
  
  console.log('\n✅ Data wipe complete! User can now log in and create a new hero.');
  console.log('='.repeat(60));
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage: node scripts/wipe-user-data.js <twitchUserId>');
    console.error('   Example: node scripts/wipe-user-data.js 12345678');
    console.error('   Example: node scripts/wipe-user-data.js "dingo dynasty"');
    process.exit(1);
  }
  
  const input = args[0];
  let twitchUserId = input;
  
  // If input looks like a username (not just numbers), search for it
  if (isNaN(input) || input.includes(' ')) {
    twitchUserId = await findUserByUsername(input);
    if (!twitchUserId) {
      console.error(`\n❌ Could not find user with username "${input}"`);
      console.error('   Try using their Twitch ID directly instead');
      process.exit(1);
    }
  } else {
    // Try to parse as number, but keep as string if it's very large
    twitchUserId = /^\d+$/.test(input) ? (input.length < 15 ? parseInt(input, 10) : input) : input;
  }
  
  // Confirm before proceeding
  console.log(`\n⚠️  WARNING: This will PERMANENTLY DELETE all data for Twitch ID: ${twitchUserId}`);
  console.log('   This action cannot be undone!\n');
  
  // In a real scenario, you might want to add a confirmation prompt here
  // For now, we'll proceed automatically (you can add readline if needed)
  
  await deleteAllUserData(twitchUserId);
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


