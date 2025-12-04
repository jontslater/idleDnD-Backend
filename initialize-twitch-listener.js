/**
 * Initialize Twitch Chat Listener for theneverendingwar
 * Run this to start listening to your Twitch chat for commands
 */

import { initializeStreamerChatListener } from './src/websocket/twitch-events.js';
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function initialize() {
  try {
    console.log('🔍 Looking up theneverendingwar hero...');
    
    // Find your hero
    const heroSnapshot = await db.collection('heroes')
      .where('twitchUsername', '==', 'theneverendingwar')
      .limit(1)
      .get();
    
    if (heroSnapshot.empty) {
      console.error('❌ No hero found for theneverendingwar');
      console.log('   You need to log in to the web app first to create your hero document.');
      process.exit(1);
    }
    
    const hero = heroSnapshot.docs[0].data();
    const heroId = heroSnapshot.docs[0].id;
    
    console.log('✅ Found hero:', hero.name);
    console.log('   Twitch Username:', hero.twitchUsername);
    console.log('   Twitch ID:', hero.twitchUserId);
    
    // Check if we have access token
    if (!hero.twitchAccessToken) {
      console.error('❌ No Twitch access token found');
      console.log('   You need to log in to the web app to authorize Twitch access.');
      process.exit(1);
    }
    
    console.log('🚀 Initializing Twitch chat listener...');
    
    // Initialize streamer chat listener
    await initializeStreamerChatListener(
      hero.twitchUsername,
      hero.twitchAccessToken,
      heroId
    );
    
    console.log('✅ Twitch chat listener initialized!');
    console.log('   Listening to: #' + hero.twitchUsername);
    console.log('   Chat commands will now be processed.');
    console.log('   Active chatter tracking is enabled.');
    console.log('');
    console.log('   Press Ctrl+C to stop.');
    
  } catch (error) {
    console.error('❌ Error initializing:', error);
    process.exit(1);
  }
}

initialize();
