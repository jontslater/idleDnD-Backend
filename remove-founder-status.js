/**
 * Script to remove founder pack status from a hero
 * Usage: node remove-founder-status.js <heroId>
 * Example: node remove-founder-status.js NRy5VebeCTxM3wX99k1o
 */

import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    
    if (!serviceAccount.project_id) {
      // Try to load from file
      const fs = await import('fs');
      const path = await import('path');
      const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
      
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccountData = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccountData)
        });
      } else {
        console.error('Firebase service account not found. Set FIREBASE_SERVICE_ACCOUNT env var or add serviceAccountKey.json');
        process.exit(1);
      }
    } else {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const heroId = process.argv[2];

if (!heroId) {
  console.error('Usage: node remove-founder-status.js <heroId>');
  console.error('Example: node remove-founder-status.js NRy5VebeCTxM3wX99k1o');
  process.exit(1);
}

async function removeFounderStatus() {
  try {
    console.log(`Removing founder pack status from hero: ${heroId}...`);
    
    const heroRef = db.collection('heroes').doc(heroId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      console.error(`❌ Hero ${heroId} not found`);
      process.exit(1);
    }
    
    const hero = heroDoc.data();
    console.log(`Hero found: ${hero.name || 'Unknown'} (${hero.twitchUsername || hero.username || 'No username'})`);
    console.log(`Current founder pack tier: ${hero.founderPackTier || 'none'}`);
    
    // Remove founder pack fields
    await heroRef.update({
      founderPackTier: admin.firestore.FieldValue.delete(),
      founderPackTierLevel: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Successfully removed founder pack status from hero');
    console.log(`Hero ${heroId} will no longer appear in Founders Hall`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to remove founder status:', error.message);
    process.exit(1);
  }
}

removeFounderStatus();
