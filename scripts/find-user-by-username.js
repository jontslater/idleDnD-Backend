/**
 * Find User by Username
 * 
 * This script searches for a user in Firebase by their username and displays
 * their Twitch ID and all associated data.
 * 
 * Usage:
 *   node scripts/find-user-by-username.js <username>
 * 
 * Example:
 *   node scripts/find-user-by-username.js "dingo dynasty"
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
  console.log(`🔍 Searching for user: "${username}"\n`);
  
  // Search in heroes collection by username
  console.log('📦 Searching heroes collection...');
  const heroesSnapshot = await db.collection('heroes')
    .where('username', '==', username)
    .get();
  
  if (heroesSnapshot.empty) {
    console.log('   ❌ No heroes found with that username');
    
    // Try case-insensitive search (Firestore doesn't support this natively, but we can try common variations)
    console.log('\n🔍 Trying case variations...');
    const variations = [
      username.toLowerCase(),
      username.toUpperCase(),
      username.charAt(0).toUpperCase() + username.slice(1).toLowerCase()
    ];
    
    for (const variant of variations) {
      if (variant === username) continue; // Skip the one we already tried
      
      const variantSnapshot = await db.collection('heroes')
        .where('username', '==', variant)
        .get();
      
      if (!variantSnapshot.empty) {
        console.log(`   ✅ Found with variation: "${variant}"`);
        heroesSnapshot = variantSnapshot;
        break;
      }
    }
    
    if (heroesSnapshot.empty) {
      console.log('   ❌ No heroes found with any case variation');
      return null;
    }
  }
  
  console.log(`   ✅ Found ${heroesSnapshot.size} hero(es)\n`);
  
  // Display all heroes found
  const results = [];
  
  for (const doc of heroesSnapshot.docs) {
    const hero = doc.data();
    const twitchUserId = hero.twitchUserId || hero.twitchId;
    const twitchIdType = hero.twitchUserId ? 'twitchUserId' : 'twitchId';
    
    console.log('='.repeat(60));
    console.log(`Hero ID: ${doc.id}`);
    console.log(`Name: ${hero.name || 'N/A'}`);
    console.log(`Username: ${hero.username || 'N/A'}`);
    console.log(`Twitch ID: ${twitchUserId} (${twitchIdType}, type: ${typeof twitchUserId})`);
    console.log(`Role: ${hero.role || 'N/A'}`);
    console.log(`Level: ${hero.level || 0}`);
    console.log(`Current Battlefield: ${hero.currentBattlefieldId || 'None'}`);
    console.log(`Created: ${hero.createdAt?.toDate?.() || hero.createdAt || 'N/A'}`);
    console.log(`Updated: ${hero.updatedAt?.toDate?.() || hero.updatedAt || 'N/A'}`);
    
    results.push({
      heroId: doc.id,
      heroName: hero.name,
      username: hero.username,
      twitchUserId: twitchUserId,
      twitchIdType: twitchIdType,
      twitchIdTypeOf: typeof twitchUserId
    });
  }
  
  // Check for user document
  if (results.length > 0) {
    const firstResult = results[0];
    console.log('\n' + '='.repeat(60));
    console.log('👤 Checking users collection...');
    
    // Try both string and number formats
    const userIdVariants = [
      String(firstResult.twitchUserId),
      typeof firstResult.twitchUserId === 'string' && /^\d+$/.test(firstResult.twitchUserId) 
        ? parseInt(firstResult.twitchUserId, 10) 
        : null
    ].filter(Boolean);
    
    for (const userId of userIdVariants) {
      try {
        const userDoc = await db.collection('users').doc(String(userId)).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log(`   ✅ Found user document for ID: ${userId}`);
          console.log(`   Slots Unlocked: ${userData.slotsUnlocked || 3}`);
          console.log(`   Created: ${userData.createdAt?.toDate?.() || userData.createdAt || 'N/A'}`);
        } else {
          console.log(`   ℹ️  No user document found for ID: ${userId}`);
        }
      } catch (error) {
        console.log(`   ⚠️  Error checking user document for ${userId}: ${error.message}`);
      }
    }
  }
  
  // Check for purchases
  if (results.length > 0) {
    const firstResult = results[0];
    console.log('\n' + '='.repeat(60));
    console.log('💳 Checking purchases collection...');
    
    const userIdVariants = [
      firstResult.twitchUserId,
      typeof firstResult.twitchUserId === 'string' && /^\d+$/.test(firstResult.twitchUserId) 
        ? parseInt(firstResult.twitchUserId, 10) 
        : null
    ].filter(Boolean);
    
    const fieldVariants = ['twitchUserId', 'twitchId'];
    let purchaseCount = 0;
    
    for (const userId of userIdVariants) {
      for (const field of fieldVariants) {
        try {
          const purchasesSnapshot = await db.collection('purchases')
            .where(field, '==', userId)
            .get();
          
          if (!purchasesSnapshot.empty) {
            purchaseCount += purchasesSnapshot.size;
            console.log(`   Found ${purchasesSnapshot.size} purchase(s) with ${field} = ${userId}`);
          }
        } catch (error) {
          // Ignore query errors
        }
      }
    }
    
    if (purchaseCount === 0) {
      console.log('   ℹ️  No purchases found');
    } else {
      console.log(`   ✅ Total purchases: ${purchaseCount}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  
  if (results.length > 0) {
    const uniqueTwitchIds = [...new Set(results.map(r => r.twitchUserId))];
    console.log(`Found ${results.length} hero(es) for username "${username}"`);
    console.log(`Twitch ID(s): ${uniqueTwitchIds.join(', ')}`);
    console.log(`\nTo wipe this user's data, run:`);
    console.log(`  node scripts/wipe-user-data.js "${uniqueTwitchIds[0]}"`);
  } else {
    console.log(`❌ No data found for username "${username}"`);
    console.log(`\nThis user may not exist in the database yet.`);
    console.log(`They should be able to create a hero with !join in chat.`);
  }
  
  return results;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('❌ Usage: node scripts/find-user-by-username.js <username>');
    console.error('   Example: node scripts/find-user-by-username.js "dingo dynasty"');
    process.exit(1);
  }
  
  const username = args[0];
  await findUserByUsername(username);
  
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});



