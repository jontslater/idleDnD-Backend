/**
 * Script to clean up test auctions created by create-test-auctions.js
 * Deletes all active listings from test sellers (theneverendingwar, tehchno)
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
  } else {
    // Try loading from file
    try {
      const { readFileSync } = await import('fs');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
      const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
      const serviceAccountFile = JSON.parse(serviceAccountContent);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFile)
      });
      db = admin.firestore();
    } catch (err) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set and serviceAccountKey.json not found');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

// Helper function to find hero by username
async function findHeroByUsername(username) {
  try {
    const allHeroesSnapshot = await db.collection('heroes').get();
    
    for (const doc of allHeroesSnapshot.docs) {
      const hero = doc.data();
      const heroName = (hero.name || '').toLowerCase();
      const searchName = username.toLowerCase();
      
      if (heroName === searchName || heroName.includes(searchName) || searchName.includes(heroName)) {
        return { ...hero, docId: doc.id, id: hero.id || doc.id };
      }
      
      if (hero.twitchUserId && String(hero.twitchUserId).toLowerCase() === searchName) {
        return { ...hero, docId: doc.id, id: hero.id || doc.id };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding hero for username ${username}:`, error);
    return null;
  }
}

// Main cleanup function
async function cleanupTestAuctions() {
  console.log('🧹 Cleaning Up Test Auctions\n');
  
  // Find test heroes
  const seller1 = await findHeroByUsername('theneverendingwar');
  const seller2 = await findHeroByUsername('tehchno');
  
  const sellerIds = [];
  if (seller1) {
    sellerIds.push(seller1.docId || seller1.id);
    console.log(`✅ Found seller: ${seller1.name} (ID: ${seller1.docId || seller1.id})`);
  }
  if (seller2) {
    sellerIds.push(seller2.docId || seller2.id);
    console.log(`✅ Found seller: ${seller2.name} (ID: ${seller2.docId || seller2.id})`);
  }
  
  if (sellerIds.length === 0) {
    console.log('⚠️  No test sellers found, but will check all active listings\n');
  }
  
  // Get all active listings
  const listingsSnapshot = await db.collection('auctionListings')
    .where('status', '==', 'active')
    .get();
  
  console.log(`📋 Found ${listingsSnapshot.size} active listings\n`);
  
  let deleted = 0;
  let skipped = 0;
  let refunded = 0;
  
  // Delete listings from test sellers
  for (const doc of listingsSnapshot.docs) {
    const listing = doc.data();
    const sellerId = listing.sellerId;
    
    // If we have specific seller IDs, only delete those
    // Otherwise, delete all active listings (use with caution!)
    const shouldDelete = sellerIds.length === 0 || sellerIds.includes(sellerId);
    
    if (shouldDelete) {
      try {
        // Refund listing fee to seller
        if (listing.listingFee && sellerId) {
          const heroRef = db.collection('heroes').doc(sellerId);
          const heroDoc = await heroRef.get();
          
          if (heroDoc.exists) {
            const hero = heroDoc.data();
            const currentGold = hero.gold || 0;
            
            // Refund 50% of listing fee (standard cancellation refund)
            const refundAmount = Math.floor(listing.listingFee * 0.5);
            await heroRef.update({
              gold: currentGold + refundAmount,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            
            console.log(`  💰 Refunded ${refundAmount}g to ${listing.sellerUsername || sellerId}`);
            refunded++;
          }
        }
        
        // Delete the listing
        await doc.ref.delete();
        console.log(`  🗑️  Deleted: ${listing.item?.name || 'Unknown Item'} (${listing.sellerUsername || sellerId})`);
        deleted++;
      } catch (error) {
        console.error(`  ❌ Error deleting listing ${doc.id}:`, error.message);
        skipped++;
      }
    } else {
      skipped++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Deleted: ${deleted} auctions`);
  console.log(`💰 Refunded: ${refunded} sellers`);
  console.log(`⏭️  Skipped: ${skipped} auctions`);
  
  process.exit(0);
}

// Run
cleanupTestAuctions().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});









