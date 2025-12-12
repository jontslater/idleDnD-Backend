/**
 * Script to remove a stuck hero from a battlefield
 * Usage: node remove-stuck-hero.js [username] [level] [class]
 * Example: node remove-stuck-hero.js tehchno 66 agile
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
  // Try to load service account key from file
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase initialized from serviceAccountKey.json');
  } else {
    // Try environment variables
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
      throw new Error('Firebase credentials not found. Please provide serviceAccountKey.json or set environment variables.');
    }
  }
  
  db = admin.firestore();
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

async function removeStuckHero(username, level, className) {
  try {
    console.log(`\n🔍 Searching for hero: ${username}, Level ${level}, ${className}`);
    
    // First, try to find heroes in any battlefield (stuck heroes)
    console.log(`\n🔍 Searching for heroes in battlefields...`);
    const heroesInBattlefield = await db.collection('heroes')
      .where('currentBattlefieldId', '!=', null)
      .get();
    
    console.log(`   Found ${heroesInBattlefield.docs.length} heroes in battlefields`);
    if (heroesInBattlefield.docs.length > 0) {
      console.log(`\n📋 Heroes currently in battlefields:`);
      heroesInBattlefield.docs.forEach(doc => {
        const hero = doc.data();
        console.log(`   - ${hero.name || 'Unknown'} (${hero.role || 'Unknown'}) Level ${hero.level || 1} - User: ${hero.twitchUsername || hero.twitchUserId} - Battlefield: ${hero.currentBattlefieldId} - ID: ${doc.id}`);
      });
    }
    
    // Find the user's heroes
    let heroesSnapshot = await db.collection('heroes')
      .where('twitchUsername', '==', username.toLowerCase())
      .get();
    
    if (heroesSnapshot.empty) {
      // Try by twitchUserId if we have it
      console.log(`⚠️  No heroes found by username, trying by userId...`);
      heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', username)
        .get();
      
      if (heroesSnapshot.empty) {
        console.error(`❌ No heroes found for user: ${username}`);
        return;
      }
    }
    
    // Show all heroes first
    console.log(`\n📋 All heroes for ${username}:`);
    const allHeroes = heroesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    allHeroes.forEach(hero => {
      console.log(`   - ${hero.name || 'Unknown'} (${hero.role || 'Unknown'}) Level ${hero.level || 1} - Battlefield: ${hero.currentBattlefieldId || 'none'} - ID: ${hero.id}`);
    });
    
    // Filter heroes by level and class (or all if "all" specified)
    const matchingHeroes = [];
    if (removeAll) {
      // Remove all heroes that have a currentBattlefieldId (from the battlefield search, not just user's heroes)
      heroesInBattlefield.docs.forEach(doc => {
        const hero = { id: doc.id, ...doc.data() };
        const heroUsername = (hero.twitchUsername || hero.name || '').toLowerCase();
        const heroUserId = String(hero.twitchUserId || '');
        const searchUsername = username.toLowerCase();
        
        // Match by username or userId (check both)
        // Also check if the name matches (some heroes might have name set to username)
        const usernameMatch = heroUsername === searchUsername || heroUsername.includes(searchUsername);
        const userIdMatch = heroUserId === username || heroUserId === String(username);
        const nameMatch = (hero.name || '').toLowerCase().includes(searchUsername);
        
        if (usernameMatch || userIdMatch || nameMatch) {
          if (hero.currentBattlefieldId && hero.currentBattlefieldId !== 'world') {
            matchingHeroes.push(hero);
          }
        }
      });
      if (matchingHeroes.length === 0) {
        console.log(`\n✅ No heroes in battlefield to remove for user: ${username}`);
        return;
      }
    } else {
      allHeroes.forEach(hero => {
        const heroLevel = hero.level || 1;
        const heroClass = (hero.role || '').toLowerCase();
        const heroName = (hero.name || '').toLowerCase();
        const searchClass = (className || '').toLowerCase();
        
        const levelMatch = !level || heroLevel === parseInt(level, 10);
        const classMatch = !className || 
                          heroClass.includes(searchClass) || 
                          searchClass.includes(heroClass) ||
                          heroName.includes(searchClass);
        
        if (levelMatch && classMatch) {
          matchingHeroes.push(hero);
        }
      });
      
      if (matchingHeroes.length === 0) {
        console.error(`\n❌ No matching heroes found for: ${username}, Level ${level}, ${className}`);
        console.log(`\n💡 Tip: If you see the hero above, you can run:`);
        console.log(`   node remove-stuck-hero.js ${username} [level] [class]`);
        console.log(`   Or remove all heroes from battlefield:`);
        console.log(`   node remove-stuck-hero.js ${username} all`);
        return;
      }
    }
    
    if (matchingHeroes.length > 1) {
      console.log(`⚠️  Multiple heroes found, removing all matching heroes:`);
      matchingHeroes.forEach(h => {
        console.log(`   - ${h.name || 'Unknown'} (${h.role || 'Unknown'}) Level ${h.level || 1} - Battlefield: ${h.currentBattlefieldId || 'none'}`);
      });
    }
    
    // Remove each matching hero from battlefield
    for (const hero of matchingHeroes) {
      const heroRef = db.collection('heroes').doc(hero.id);
      const oldBattlefieldId = hero.currentBattlefieldId;
      
      console.log(`\n🔄 Removing hero: ${hero.name || 'Unknown'} (${hero.id})`);
      console.log(`   Current battlefield: ${oldBattlefieldId || 'none'}`);
      
      // Remove currentBattlefieldId using FieldValue.delete()
      try {
        await heroRef.update({
          currentBattlefieldId: admin.firestore.FieldValue.delete(),
          currentBattlefieldType: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Verify the update
        await new Promise(resolve => setTimeout(resolve, 200));
        const updatedDoc = await heroRef.get();
        if (updatedDoc.exists) {
          const updatedData = updatedDoc.data();
          if (updatedData.currentBattlefieldId === null || updatedData.currentBattlefieldId === undefined) {
            console.log(`✅ Hero removed from battlefield successfully!`);
          } else {
            console.warn(`⚠️  FieldValue.delete() didn't work, trying null...`);
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
        // Try set() as fallback
        try {
          const heroData = await heroRef.get();
          if (heroData.exists) {
            const data = heroData.data();
            delete data.currentBattlefieldId;
            delete data.currentBattlefieldType;
            data.updatedAt = admin.firestore.FieldValue.serverTimestamp();
            await heroRef.set(data, { merge: true });
            console.log(`✅ Hero removed using set() fallback`);
          }
        } catch (setError) {
          console.error(`❌ All methods failed:`, setError.message);
        }
      }
      
      // Broadcast hero_left_battlefield if there's a battlefield
      if (oldBattlefieldId && oldBattlefieldId !== 'world') {
        try {
          // Import WebSocket server to broadcast
          const { broadcastToRoom } = await import('./src/websocket/server.js');
          
          // Convert battlefield ID to Twitch ID for WebSocket room
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
    }
    
    console.log(`\n✅ Done! Removed ${matchingHeroes.length} hero(es) from battlefield.`);
    
  } catch (error) {
    console.error('❌ Error removing stuck hero:', error);
    throw error;
  }
}

// Get command line arguments
const args = process.argv.slice(2);
const username = args[0] || 'tehchno';
const level = args[1] || '66';
const className = args[2] || 'agile';

// Special case: "all" removes all heroes from battlefield
const removeAll = level === 'all' || className === 'all';

console.log(`\n🚀 Removing stuck hero script`);
console.log(`   Username: ${username}`);
console.log(`   Level: ${level}`);
console.log(`   Class: ${className}`);

removeStuckHero(username, level, className)
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
