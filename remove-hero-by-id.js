/**
 * Script to remove a hero from battlefield by document ID
 * Usage: node remove-hero-by-id.js [heroId]
 * Example: node remove-hero-by-id.js n8DKaw8TvEYkssj5HgFY
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
let db;
try {
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase initialized from serviceAccountKey.json');
  } else {
    const serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
    };
    
    if (serviceAccount.project_id && serviceAccount.private_key) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase initialized from environment variables');
    } else {
      throw new Error('Firebase credentials not found.');
    }
  }
  
  db = admin.firestore();
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

async function removeHeroById(heroId) {
  try {
    const heroRef = db.collection('heroes').doc(heroId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      console.error(`❌ Hero document ${heroId} does not exist`);
      console.log(`\n💡 The hero may have been deleted. Let's try to broadcast removal anyway...`);
      
      // Try to broadcast removal for the battlefield anyway
      const battlefieldId = 'twitch:theneverendingwar';
      let streamerTwitchId = null;
      if (battlefieldId.startsWith('twitch:')) {
        const identifier = battlefieldId.replace('twitch:', '').trim();
        
        // Check if it's a numeric Twitch ID (like "1087777297")
        if (/^\d+$/.test(identifier)) {
          // It's already a numeric ID, use it directly
          streamerTwitchId = identifier;
        } else {
          // It's a username, look up streamer's Twitch ID from their hero document
          const streamerUsername = identifier.toLowerCase();
          const streamerHeroSnapshot = await db.collection('heroes')
            .where('twitchUsername', '==', streamerUsername)
            .limit(1)
            .get();
          
          if (!streamerHeroSnapshot.empty) {
            const streamerHero = streamerHeroSnapshot.docs[0].data();
            streamerTwitchId = streamerHero.twitchUserId || streamerHero.twitchId;
          }
        }
      }
      
      if (streamerTwitchId) {
        const { broadcastToRoom } = await import('./src/websocket/server.js');
        broadcastToRoom(String(streamerTwitchId), {
          type: 'hero_left_battlefield',
          hero: { id: heroId, name: 'tehchno', role: 'vanguard', level: 66 },
          message: `tehchno has left the battlefield`,
          timestamp: Date.now()
        });
        console.log(`📡 Broadcasted hero_left_battlefield to Twitch ID: ${streamerTwitchId}`);
        console.log(`✅ Hero removal broadcasted (document was already deleted)`);
      }
      return;
    }
    
    const hero = { id: heroDoc.id, ...heroDoc.data() };
    const oldBattlefieldId = hero.currentBattlefieldId;
    
    console.log(`\n🔄 Removing hero: ${hero.name || 'Unknown'} (${hero.id})`);
    console.log(`   Role: ${hero.role || 'Unknown'}, Level: ${hero.level || 1}`);
    console.log(`   Current battlefield: ${oldBattlefieldId || 'none'}`);
    
    // Remove currentBattlefieldId
    try {
      await heroRef.update({
        currentBattlefieldId: admin.firestore.FieldValue.delete(),
        currentBattlefieldType: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      await new Promise(resolve => setTimeout(resolve, 200));
      const updatedDoc = await heroRef.get();
      if (updatedDoc.exists) {
        const updatedData = updatedDoc.data();
        if (updatedData.currentBattlefieldId === null || updatedData.currentBattlefieldId === undefined) {
          console.log(`✅ Hero removed from battlefield successfully!`);
        } else {
          await heroRef.update({
            currentBattlefieldId: null,
            currentBattlefieldType: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Hero removed from battlefield (set to null)`);
        }
      }
    } catch (updateError) {
      console.error(`❌ Failed to update hero:`, updateError.message);
    }
    
    // Broadcast removal
    if (oldBattlefieldId && oldBattlefieldId !== 'world') {
      try {
        const { broadcastToRoom } = await import('./src/websocket/server.js');
        
        let streamerTwitchId = null;
        if (oldBattlefieldId.startsWith('twitch:')) {
          const identifier = oldBattlefieldId.replace('twitch:', '').trim();
          
          // Check if it's a numeric Twitch ID (like "1087777297")
          if (/^\d+$/.test(identifier)) {
            // It's already a numeric ID, use it directly
            streamerTwitchId = identifier;
          } else {
            // It's a username, look up streamer's Twitch ID from their hero document
            const streamerUsername = identifier.toLowerCase();
            const streamerHeroSnapshot = await db.collection('heroes')
              .where('twitchUsername', '==', streamerUsername)
              .limit(1)
              .get();
            
            if (!streamerHeroSnapshot.empty) {
              const streamerHero = streamerHeroSnapshot.docs[0].data();
              streamerTwitchId = streamerHero.twitchUserId || streamerHero.twitchId;
            }
          }
        } else {
          streamerTwitchId = oldBattlefieldId;
        }
        
        if (streamerTwitchId) {
          broadcastToRoom(String(streamerTwitchId), {
            type: 'hero_left_battlefield',
            hero: { ...hero, id: hero.id },
            message: `${hero.name || 'Hero'} has left the battlefield`,
            timestamp: Date.now()
          });
          console.log(`📡 Broadcasted hero_left_battlefield to Twitch ID: ${streamerTwitchId}`);
        }
      } catch (broadcastError) {
        console.warn(`⚠️  Failed to broadcast (non-critical):`, broadcastError.message);
      }
    }
    
    console.log(`\n✅ Done!`);
    
  } catch (error) {
    console.error('❌ Error removing hero:', error);
    throw error;
  }
}

const heroId = process.argv[2] || 'n8DKaw8TvEYkssj5HgFY';

console.log(`\n🚀 Removing hero by ID: ${heroId}`);

removeHeroById(heroId)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
