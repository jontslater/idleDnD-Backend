/**
 * Test Script: Full Game Flow
 * Tests the complete flow: Idle Adventure → Dungeon Queue → Dungeon → Idle → Raid Queue → Raid → Idle
 * 
 * Usage: node test-flow-script.js
 * 
 * This script:
 * 1. Creates test heroes
 * 2. Starts idle adventure
 * 3. Joins dungeon queue
 * 4. Starts and completes dungeon
 * 5. Returns to idle
 * 6. Joins raid queue
 * 7. Starts and completes raid
 * 8. Returns to idle
 */

import fetch from 'node-fetch';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin (same logic as index.js)
let db;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const serviceAccountPath = join(__dirname, 'serviceAccountKey.json');
  
  // Try to load service account from file first
  let credential;
  try {
    // Use fs.readFileSync for more reliable JSON loading with ES modules
    const { readFileSync } = await import('fs');
    const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
    const serviceAccount = JSON.parse(serviceAccountContent);
    credential = admin.credential.cert(serviceAccount);
    console.log('📁 Using serviceAccountKey.json');
  } catch (err) {
    // Fallback to environment variables
    console.log('📝 Using environment variables for Firebase credentials');
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing Firebase environment variables. Please check your .env file.');
    }
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    });
  }
  
  if (!admin.apps.length) {
    admin.initializeApp({ credential });
  }
  db = admin.firestore();
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Test configuration
const TEST_CONFIG = {
  userId: 'test-flow-user',
  streamerUsername: 'teststreamer',
  battlefieldId: 'twitch:teststreamer',
  dungeonId: 'goblin_cave', // Solo dungeon for quick testing
  raidId: 'corrupted_temple', // Normal raid
  heroRole: 'berserker',
  heroLevel: 20, // High enough for dungeons and raids
  itemScore: 600, // High enough for requirements
  // Low XP enemies for quick completion
  enemyXpMultiplier: 0.1 // 10% of normal XP
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(step, message, color = 'reset') {
  const timestamp = new Date().toISOString();
  console.log(`${colors[color]}[${step}]${colors.reset} ${message}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiCall(method, endpoint, body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    const data = await response.json();
    
    if (!response.ok) {
      // Log more details about the error
      log('ERROR', `API call failed: ${endpoint} - Status: ${response.status}`, 'red');
      log('ERROR', `Response: ${JSON.stringify(data, null, 2)}`, 'red');
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    return data;
  } catch (error) {
    log('ERROR', `API call failed: ${endpoint} - ${error.message}`, 'red');
    throw error;
  }
}

async function createTestHero() {
  log('SETUP', 'Creating test hero...', 'cyan');
  
  try {
    // Check if hero already exists
    const existingHeroes = await db.collection('heroes')
      .where('twitchUserId', '==', TEST_CONFIG.userId)
      .limit(1)
      .get();
    
    if (!existingHeroes.empty) {
      const hero = existingHeroes.docs[0];
      log('SETUP', `Using existing hero: ${hero.id}`, 'yellow');
      
      // Ensure hero has equipment and stats for testing
      const testEquipment = {
        weapon: { attack: 200, defense: 50, hp: 100, rarity: 'epic' },
        armor: { attack: 50, defense: 200, hp: 200, rarity: 'epic' },
        helmet: { attack: 30, defense: 100, hp: 100, rarity: 'rare' },
        boots: { attack: 20, defense: 80, hp: 80, rarity: 'rare' },
        gloves: { attack: 25, defense: 90, hp: 90, rarity: 'rare' }
      };
      
      const heroData = hero.data();
      const needsUpdate = !heroData.equipment || 
                         heroData.level !== TEST_CONFIG.heroLevel ||
                         !heroData.equipment.weapon;
      
      if (needsUpdate) {
        await hero.ref.update({
          level: TEST_CONFIG.heroLevel,
          hp: 10000,
          maxHp: 10000,
          attack: 500,
          defense: 300,
          equipment: testEquipment,
          name: heroData.name || 'TestFlowUser',
          role: heroData.role || TEST_CONFIG.heroRole
        });
        log('SETUP', 'Updated existing hero with equipment and stats', 'yellow');
      }
      
      const updatedHero = await hero.ref.get();
      return { id: updatedHero.id, ...updatedHero.data() };
    }
    
    // Create new hero via join endpoint
    const joinResult = await apiCall('POST', '/api/chat/join', {
      viewerUsername: 'TestFlowUser',
      viewerId: TEST_CONFIG.userId,
      streamerUsername: TEST_CONFIG.streamerUsername,
      class: TEST_CONFIG.heroRole
    });
    
    if (!joinResult.hero) {
      throw new Error('Failed to create hero');
    }
    
    // Update hero to have high level and stats for testing
    // Add equipment to meet item score requirements (500+ for raids)
    const testEquipment = {
      weapon: { attack: 200, defense: 50, hp: 100, rarity: 'epic' },
      armor: { attack: 50, defense: 200, hp: 200, rarity: 'epic' },
      helmet: { attack: 30, defense: 100, hp: 100, rarity: 'rare' },
      boots: { attack: 20, defense: 80, hp: 80, rarity: 'rare' },
      gloves: { attack: 25, defense: 90, hp: 90, rarity: 'rare' }
    };
    
    const heroRef = db.collection('heroes').doc(joinResult.hero.id);
    await heroRef.update({
      level: TEST_CONFIG.heroLevel,
      hp: 10000,
      maxHp: 10000,
      attack: 500,
      defense: 300,
      gold: 10000,
      tokens: 1000,
      xp: 0,
      maxXp: 10000,
      // Ensure name field exists (required by dungeon route)
      name: joinResult.hero.name || 'TestFlowUser',
      role: joinResult.hero.role || TEST_CONFIG.heroRole,
      equipment: testEquipment // Add equipment for item score calculation
    });
    
    const updatedHero = await heroRef.get();
    log('SETUP', `Created test hero: ${updatedHero.id}`, 'green');
    return { id: updatedHero.id, ...updatedHero.data() };
  } catch (error) {
    log('ERROR', `Failed to create hero: ${error.message}`, 'red');
    throw error;
  }
}

async function waitForCombatToComplete(instanceId, instanceType = 'dungeon') {
  log('COMBAT', `Waiting for ${instanceType} combat to complete...`, 'yellow');
  
  const maxWaitTime = 300000; // 5 minutes max
  const checkInterval = 5000; // Check every 5 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    await sleep(checkInterval);
    
    try {
      const endpoint = instanceType === 'dungeon' 
        ? `/api/dungeon/instance/${instanceId}`
        : `/api/raids/instance/${instanceId}`;
      
      const instance = await apiCall('GET', endpoint);
      
      if (instance.status === 'completed' || instance.status === 'failed') {
        log('COMBAT', `${instanceType} completed with status: ${instance.status}`, 'green');
        return instance;
      }
      
      // Update progress to simulate combat
      // Also handle 'starting' status for raids (will update to 'active' in progress update)
      if (instance.status === 'active' || instance.status === 'in-progress' || 
          (instanceType === 'raid' && instance.status === 'starting')) {
        const progressEndpoint = instanceType === 'dungeon'
          ? `/api/dungeon/instance/${instanceId}/progress`
          : `/api/raids/instance/${instanceId}/progress`;
        
        // Simulate progress - advance room for dungeons, reduce boss HP for raids
        if (instanceType === 'dungeon') {
          const currentRoom = instance.currentRoom || 0;
          const maxRooms = instance.maxRooms || instance.rooms?.length || 3;
          
          // Advance to next room
          const nextRoom = currentRoom + 1;
          
          await apiCall('POST', progressEndpoint, {
            room: nextRoom,
            participants: instance.participants || [],
            combatLogEntries: [] // Empty array instead of undefined
          });
          
          // If we've completed all rooms, complete the dungeon
          if (nextRoom >= maxRooms) {
            log('COMBAT', 'All rooms completed! Completing dungeon...', 'green');
            const completeEndpoint = `/api/dungeon/instance/${instanceId}/complete`;
            
            await apiCall('POST', completeEndpoint, {
              success: true,
              finalParticipants: instance.participants || [],
              finalCombatLog: instance.combatLog || []
            });
            
            return await apiCall('GET', endpoint);
          }
        } else {
          // For raids, reduce boss HP percentage
          const currentBossHp = instance.bossHp || instance.boss?.hp || 1000;
          const bossMaxHp = instance.bossMaxHp || instance.boss?.maxHp || instance.boss?.hp || 1000;
          const currentBossHpPercent = (currentBossHp / bossMaxHp) * 100;
          
          // Reduce boss HP by 20% each check (so it completes in 5 checks)
          const newBossHpPercent = Math.max(0, currentBossHpPercent - 20);
          const newBossHp = Math.floor((newBossHpPercent / 100) * bossMaxHp);
          
          log('COMBAT', `Raid progress: Boss HP ${currentBossHpPercent.toFixed(1)}% -> ${newBossHpPercent.toFixed(1)}%`, 'yellow');
          
          // Update raid status to 'active' if it's still 'starting'
          if (instance.status === 'starting') {
            await db.collection('raidInstances').doc(instanceId).update({
              status: 'active'
            });
            log('COMBAT', 'Updated raid status from "starting" to "active"', 'yellow');
          }
          
          await apiCall('POST', progressEndpoint, {
            wave: instance.currentWave || 1,
            bossHpPercent: newBossHpPercent,
            participants: instance.participants || [],
            combatLogEntries: []
          });
          
          // Also update bossHp directly in the instance (progress endpoint might not update it)
          await db.collection('raidInstances').doc(instanceId).update({
            bossHp: newBossHp
          });
          
          // If boss HP reaches 0%, complete the raid
          if (newBossHpPercent <= 0) {
            log('COMBAT', 'Boss defeated! Completing raid...', 'green');
            const completeEndpoint = `/api/raids/instance/${instanceId}/complete`;
            
            await apiCall('POST', completeEndpoint, {
              success: true,
              finalParticipants: instance.participants || [],
              finalCombatLog: instance.combatLog || []
            });
            
            return await apiCall('GET', endpoint);
          }
        }
      }
    } catch (error) {
      log('WARN', `Error checking ${instanceType} status: ${error.message}`, 'yellow');
    }
  }
  
  throw new Error(`${instanceType} did not complete within timeout`);
}

async function testIdleAdventure(hero, isTransition = false) {
  if (isTransition) {
    log('TRANSITION', '🔄 Entering Idle Adventure...', 'bright');
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ cyan`);
  }
  
  log('IDLE', 'Starting idle adventure phase...', 'cyan');
  
  // Hero should be in battlefield for idle adventure
  await db.collection('heroes').doc(hero.id).update({
    currentBattlefieldId: TEST_CONFIG.battlefieldId,
    currentBattlefieldType: 'streamer'
  });
  
  log('IDLE', 'Hero is in battlefield - idle adventure should start automatically', 'green');
  log('TRANSITION', '>>> IN IDLE ADVENTURE <<<', 'bright');
  console.log(`${colors.bright}${colors.cyan}>>> Browser Source should show idle combat battlefield${colors.reset}\n`);
  await sleep(5000); // Wait 5 seconds for idle combat to start
  log('IDLE', 'Idle adventure phase complete', 'green');
}

async function testDungeonFlow(hero) {
  log('DUNGEON', '=== Starting Dungeon Flow ===', 'magenta');
  
  try {
    // Step 0: Check if already in queue and leave if needed
    log('DUNGEON', 'Step 0: Checking queue status...', 'cyan');
    try {
      const queueStatus = await apiCall('GET', `/api/dungeon/queue/status?userId=${TEST_CONFIG.userId}`);
      
      if (queueStatus.inQueue) {
        log('DUNGEON', 'Already in queue, leaving first...', 'yellow');
        // Use the DELETE endpoint to leave queue
        await apiCall('DELETE', '/api/dungeon/queue', { userId: TEST_CONFIG.userId });
        log('DUNGEON', 'Left queue successfully', 'green');
        await sleep(1000);
      }
    } catch (error) {
      // Not in queue, which is fine
      log('DUNGEON', 'Not in queue, proceeding...', 'yellow');
    }
    
    // Step 1: Join dungeon queue
    log('DUNGEON', 'Step 1: Joining dungeon queue...', 'cyan');
    const queueResult = await apiCall('POST', '/api/dungeon/queue', {
      userId: TEST_CONFIG.userId,
      heroId: hero.id,
      role: 'dps',
      itemScore: TEST_CONFIG.itemScore,
      dungeonType: 'normal'
    });
    log('DUNGEON', `Joined queue: ${queueResult.queueId || 'success'}`, 'green');
    
    // Step 2: Check queue status
    await sleep(2000);
    const queueStatus = await apiCall('GET', `/api/dungeon/queue/status?userId=${TEST_CONFIG.userId}`);
    log('DUNGEON', `Queue status: ${JSON.stringify(queueStatus)}`, 'yellow');
    
    // Step 3: Start dungeon (simulate matchmaking or manual start)
    log('DUNGEON', 'Step 2: Starting dungeon instance...', 'cyan');
    log('DUNGEON', `Hero ID: ${hero.id}`, 'yellow');
    log('DUNGEON', `Dungeon ID: ${TEST_CONFIG.dungeonId}`, 'yellow');
    
    // The dungeon route expects participants as hero document IDs
    const requestBody = {
      participants: [hero.id], // Pass hero document ID
      organizerId: TEST_CONFIG.userId
    };
    log('DUNGEON', `Request body: ${JSON.stringify(requestBody)}`, 'yellow');
    
    const startResult = await apiCall('POST', `/api/dungeon/${TEST_CONFIG.dungeonId}/start`, requestBody);
    
    if (!startResult.instanceId) {
      throw new Error('Failed to start dungeon');
    }
    
    log('DUNGEON', `Dungeon started: ${startResult.instanceId}`, 'green');
    log('TRANSITION', '>>> ENTERING DUNGEON <<<', 'bright');
    console.log(`${colors.bright}${colors.cyan}>>> Browser Source should now show: "Entering Dungeon..."${colors.reset}\n`);
    
    // Step 4: Wait for dungeon to complete
    await waitForCombatToComplete(startResult.instanceId, 'dungeon');
    
    // Step 5: Verify completion
    const completedInstance = await apiCall('GET', `/api/dungeon/instance/${startResult.instanceId}`);
    log('DUNGEON', `Dungeon completed: ${completedInstance.status}`, 'green');
    log('TRANSITION', '>>> LEAVING DUNGEON - RETURNING TO IDLE ADVENTURE <<<', 'bright');
    console.log(`${colors.bright}${colors.cyan}>>> Browser Source should now show: "Leaving Dungeon..." then "Returning to Idle Adventure..."${colors.reset}\n`);
    
    // Give time for transition to complete
    await sleep(2000);
    
    log('DUNGEON', '=== Dungeon Flow Complete ===', 'magenta');
    return completedInstance;
  } catch (error) {
    log('ERROR', `Dungeon flow failed: ${error.message}`, 'red');
    throw error;
  }
}

async function testRaidFlow(hero) {
  log('RAID', '=== Starting Raid Flow ===', 'magenta');
  
  try {
    // Step 1: Join raid queue
    log('RAID', 'Step 1: Joining raid queue...', 'cyan');
    const queueResult = await apiCall('POST', `/api/raids/queue/${TEST_CONFIG.raidId}/join`, {
      userId: TEST_CONFIG.userId,
      heroName: hero.name || 'TestHero',
      heroLevel: TEST_CONFIG.heroLevel,
      heroRole: TEST_CONFIG.heroRole,
      itemScore: TEST_CONFIG.itemScore
    });
    log('RAID', `Joined queue: ${queueResult.message || 'success'}`, 'green');
    
    // Step 2: Check queue status
    await sleep(2000);
    const queueStatus = await apiCall('GET', `/api/raids/queue/${TEST_CONFIG.raidId}`);
    log('RAID', `Queue participants: ${queueStatus.participants?.length || 0}`, 'yellow');
    
    // Step 3: Start raid (simulate enough players or manual start)
    log('RAID', 'Step 2: Starting raid instance...', 'cyan');
    
    // Create test participants for raid (needs min 3 players)
    const testParticipants = [
      { userId: TEST_CONFIG.userId, username: 'TestFlowUser', heroName: hero.name, heroLevel: TEST_CONFIG.heroLevel, heroRole: TEST_CONFIG.heroRole, itemScore: TEST_CONFIG.itemScore, isAlive: true },
      { userId: 'test-user-2', username: 'TestUser2', heroName: 'TestUser2', heroLevel: TEST_CONFIG.heroLevel, heroRole: 'guardian', itemScore: TEST_CONFIG.itemScore, isAlive: true },
      { userId: 'test-user-3', username: 'TestUser3', heroName: 'TestUser3', heroLevel: TEST_CONFIG.heroLevel, heroRole: 'cleric', itemScore: TEST_CONFIG.itemScore, isAlive: true }
    ];
    
    // The raid route uses participants as hero document IDs (see line 307-308 in raids.js)
    // We need to get hero IDs for all participants
    const heroIds = [hero.id]; // Start with our hero
    
    for (let i = 2; i <= 3; i++) {
      const testUserId = `test-user-${i}`;
      const testHeroes = await db.collection('heroes')
        .where('twitchUserId', '==', testUserId)
        .limit(1)
        .get();
      
      let testHeroId;
      if (testHeroes.empty) {
        // Create test hero for this user with equipment for item score
        const testEquipment = {
          weapon: { attack: 200, defense: 50, hp: 100, rarity: 'epic' },
          armor: { attack: 50, defense: 200, hp: 200, rarity: 'epic' },
          helmet: { attack: 30, defense: 100, hp: 100, rarity: 'rare' },
          boots: { attack: 20, defense: 80, hp: 80, rarity: 'rare' },
          gloves: { attack: 25, defense: 90, hp: 90, rarity: 'rare' }
        };
        
        const testHeroRef = await db.collection('heroes').add({
          twitchUserId: testUserId,
          name: `TestUser${i}`,
          role: i === 2 ? 'guardian' : 'cleric',
          level: TEST_CONFIG.heroLevel,
          hp: 10000,
          maxHp: 10000,
          attack: 500,
          defense: 300,
          equipment: testEquipment, // Add equipment for item score calculation
          currentBattlefieldId: null,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        testHeroId = testHeroRef.id;
        log('RAID', `Created test hero for user ${testUserId}: ${testHeroId}`, 'yellow');
      } else {
        testHeroId = testHeroes.docs[0].id;
        // Update existing hero to ensure it has equipment and meets requirements
        const existingHero = testHeroes.docs[0].data();
        const testEquipment = {
          weapon: { attack: 200, defense: 50, hp: 100, rarity: 'epic' },
          armor: { attack: 50, defense: 200, hp: 200, rarity: 'epic' },
          helmet: { attack: 30, defense: 100, hp: 100, rarity: 'rare' },
          boots: { attack: 20, defense: 80, hp: 80, rarity: 'rare' },
          gloves: { attack: 25, defense: 90, hp: 90, rarity: 'rare' }
        };
        
        const needsUpdate = !existingHero.equipment || 
                           existingHero.level !== TEST_CONFIG.heroLevel ||
                           !existingHero.equipment.weapon;
        
        if (needsUpdate) {
          await testHeroes.docs[0].ref.update({
            level: TEST_CONFIG.heroLevel,
            hp: 10000,
            maxHp: 10000,
            attack: 500,
            defense: 300,
            equipment: testEquipment,
            name: existingHero.name || `TestUser${i}`,
            role: existingHero.role || (i === 2 ? 'guardian' : 'cleric')
          });
          log('RAID', `Updated existing hero for user ${testUserId} with equipment and stats`, 'yellow');
        }
      }
      
      heroIds.push(testHeroId);
    }
    
    const startResult = await apiCall('POST', `/api/raids/${TEST_CONFIG.raidId}/start`, {
      organizerId: TEST_CONFIG.userId,
      participants: heroIds // Pass hero document IDs (route uses them as document IDs)
    });
    
    if (!startResult.instanceId) {
      throw new Error('Failed to start raid');
    }
    
    log('RAID', `Raid started: ${startResult.instanceId}`, 'green');
    log('TRANSITION', '>>> ENTERING RAID <<<', 'bright');
    console.log(`${colors.bright}${colors.cyan}>>> Browser Source should now show: "Entering Raid..."${colors.reset}\n`);
    
    // Step 4: Wait for raid to complete
    await waitForCombatToComplete(startResult.instanceId, 'raid');
    
    // Step 5: Verify completion
    const completedInstance = await apiCall('GET', `/api/raids/instance/${startResult.instanceId}`);
    log('RAID', `Raid completed: ${completedInstance.status}`, 'green');
    log('TRANSITION', '>>> LEAVING RAID - RETURNING TO IDLE ADVENTURE <<<', 'bright');
    console.log(`${colors.bright}${colors.cyan}>>> Browser Source should now show: "Leaving Raid..." then "Returning to Idle Adventure..."${colors.reset}\n`);
    
    // Give time for transition to complete
    await sleep(2000);
    
    log('RAID', '=== Raid Flow Complete ===', 'magenta');
    return completedInstance;
  } catch (error) {
    log('ERROR', `Raid flow failed: ${error.message}`, 'red');
    throw error;
  }
}

function generateBrowserSourceUrl(userId, streamerUsername) {
  // Generate a simple browser source URL for testing
  // The browser source needs to use the test user's ID to detect their active instances
  // The battlefieldId should match where the hero is (twitch:streamerUsername)
  const webUrl = process.env.WEB_URL || 'http://localhost:3000';
  const battlefieldId = `twitch:${streamerUsername}`;
  const url = new URL('/browser-source-unified', webUrl);
  url.searchParams.set('battlefieldId', battlefieldId);
  // Add userId as a parameter so the browser source can listen for this user's instances
  // The useActiveInstanceListener hook will use this to detect dungeon/raid instances
  url.searchParams.set('userId', userId);
  // Note: In production, you'd need a real token from the auth system
  // For testing, the browser source page might need to handle missing tokens
  return url.toString();
}

async function main() {
  log('START', '=== Full Game Flow Test Script ===', 'bright');
  log('START', `API Base URL: ${API_BASE_URL}`, 'yellow');
  
  // Generate and print browser source URL
  const browserSourceUrl = generateBrowserSourceUrl(TEST_CONFIG.userId, TEST_CONFIG.streamerUsername);
  log('BROWSER', '=== Browser Source URL ===', 'bright');
  log('BROWSER', 'Copy this URL to OBS Browser Source to watch the test in real-time:', 'cyan');
  console.log(`\n${colors.bright}${colors.green}${browserSourceUrl}${colors.reset}\n`);
  log('BROWSER', 'IMPORTANT: Make sure the URL includes the userId parameter!', 'yellow');
  log('BROWSER', 'The browser source will automatically switch between idle, dungeon, and raid views', 'yellow');
  log('BROWSER', 'Watch for transition messages: "Entering Dungeon...", "Entering Raid...", etc.', 'yellow');
  console.log('');
  
  try {
    // Setup: Create test hero
    const hero = await createTestHero();
    await sleep(2000);
    
    // Phase 1: Idle Adventure
    log('PHASE', '=== PHASE 1: IDLE ADVENTURE ===', 'bright');
    await testIdleAdventure(hero);
    await sleep(3000);
    
    // Phase 2: Dungeon Flow
    log('PHASE', '=== PHASE 2: DUNGEON FLOW ===', 'bright');
    await testDungeonFlow(hero);
    await sleep(3000);
    
    // Phase 3: Return to Idle
    log('PHASE', '=== PHASE 3: RETURN TO IDLE ===', 'bright');
    await testIdleAdventure(hero);
    await sleep(3000);
    
    // Phase 4: Raid Flow
    log('PHASE', '=== PHASE 4: RAID FLOW ===', 'bright');
    await testRaidFlow(hero);
    await sleep(3000);
    
    // Phase 5: Final Return to Idle
    log('PHASE', '=== PHASE 5: FINAL RETURN TO IDLE ===', 'bright');
    await testIdleAdventure(hero);
    
    log('SUCCESS', '=== All Tests Passed! ===', 'green');
    log('SUCCESS', 'Flow: Idle → Dungeon → Idle → Raid → Idle', 'green');
    
  } catch (error) {
    log('FAILED', `Test failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);
