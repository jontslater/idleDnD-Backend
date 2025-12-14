import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let db;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
  
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
  
  admin.initializeApp({ credential });
  db = admin.firestore();
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Import routes
import authRoutes from './routes/auth.js';
import heroRoutes from './routes/heroes.js';
import professionsRoutes from './routes/professions.js';
import guildRoutes from './routes/guilds.js';
import raidRoutes from './routes/raids.js';
import worldbossRoutes from './routes/worldboss.js';
import bitsRoutes from './routes/bits.js';
import questRoutes from './routes/quests.js';
import battlefieldRoutes from './routes/battlefields.js';
import skillsRoutes from './routes/skills.js';
import auctionRoutes from './routes/auction.js';
import achievementRoutes from './routes/achievements.js';
import leaderboardRoutes from './routes/leaderboards.js';
import dungeonRoutes from './routes/dungeon.js';
import enchantingRoutes from './routes/enchanting.js';
import guildPerksRoutes from './routes/guildPerks.js';
import partiesRoutes from './routes/parties.js';
import chatRoutes from './routes/chat.js';
import webChatRoutes from './routes/webChat.js';
import lootTokenRoutes from './routes/lootTokens.js';
import purchasesRoutes from './routes/purchases.js';
import mailRoutes from './routes/mail.js';
import reportsRoutes from './routes/reports.js';

// Import services
import { initializeQuestSystem } from './services/questService.js';

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/web-chat', webChatRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/heroes', heroRoutes);
app.use('/api/professions', professionsRoutes);
app.use('/api/guilds', guildRoutes);
app.use('/api/raids', raidRoutes);
app.use('/api/worldboss', worldbossRoutes);
app.use('/api/bits', bitsRoutes);
app.use('/api/quests', questRoutes);
app.use('/api/battlefields', battlefieldRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/auction', auctionRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/leaderboards', leaderboardRoutes);
app.use('/api/dungeon', dungeonRoutes);
app.use('/api/enchanting', enchantingRoutes);
app.use('/api/guild-perks', guildPerksRoutes);
app.use('/api/parties', partiesRoutes);
app.use('/api/loot-tokens', lootTokenRoutes);
app.use('/api/mail', mailRoutes);
app.use('/api/reports', reportsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    firebase: db ? 'connected' : 'disconnected'
  });
});

// Populate test data (for UI testing)
// Clean up test data
app.post('/api/test/cleanup', async (req, res) => {
  try {
    console.log('🧹 Cleaning up test data...');
    
    // Delete all test raid instances
    const raidsSnapshot = await db.collection('raidInstances').get();
    const deletionPromises = [];
    
    raidsSnapshot.forEach(doc => {
      deletionPromises.push(doc.ref.delete());
    });
    
    // Delete test world bosses
    const worldBossSnapshot = await db.collection('worldBoss').get();
    worldBossSnapshot.forEach(doc => {
      deletionPromises.push(doc.ref.delete());
    });
    
    await Promise.all(deletionPromises);
    
    console.log(`✅ Deleted ${deletionPromises.length} test documents`);
    
    res.json({
      success: true,
      message: 'Test data cleaned up!',
      deleted: deletionPromises.length
    });
  } catch (error) {
    console.error('Error cleaning up test data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/test/populate', async (req, res) => {
  try {
    console.log('🎮 Creating test data...');
    
    // Generate fake participants
    const generateParticipants = (count, raidType = 'normal') => {
      const names = ['Shadowblade', 'Lightbringer', 'Stormbringer', 'Nightshade', 'Ironforge',
        'Frostwhisper', 'Flameheart', 'Silvermoon', 'Darkstorm', 'Goldleaf',
        'Thunderfist', 'Bloodthorn', 'Starweaver', 'Windrunner', 'Earthshaker',
        'Voidwalker', 'Sunstrider', 'Moonblade', 'Stormrage', 'Dawnseeker'];
      
      const roles = ['paladin', 'warrior', 'cleric', 'druid', 'berserker', 'mage', 'hunter', 'rogue'];
      const participants = [];
      
      for (let i = 0; i < count; i++) {
        const name = names[i % names.length] + (i >= names.length ? Math.floor(i / names.length) : '');
        const role = roles[i % roles.length];
        const level = raidType === 'mythic' ? 50 + Math.floor(Math.random() * 10) :
                      raidType === 'heroic' ? 35 + Math.floor(Math.random() * 10) :
                      20 + Math.floor(Math.random() * 10);
        
        participants.push({
          userId: `test_${i}`,
          username: name,
          heroName: name,
          heroLevel: level,
          heroRole: role,
          itemScore: raidType === 'mythic' ? 6000 + Math.floor(Math.random() * 2000) :
                     raidType === 'heroic' ? 3500 + Math.floor(Math.random() * 1500) :
                     1500 + Math.floor(Math.random() * 1000),
          damageDealt: Math.floor(Math.random() * 50000),
          healingDone: Math.floor(Math.random() * 30000),
          damageTaken: Math.floor(Math.random() * 40000),
          damageBlocked: Math.floor(Math.random() * 25000),
          deaths: Math.floor(Math.random() * 3),
          isAlive: Math.random() > 0.2
        });
      }
      return participants;
    };
    
    // Create 2 test raids
    const raid1 = await db.collection('raidInstances').add({
      raidId: 'corrupted_temple',
      difficulty: 'normal',
      status: 'in-progress',
      currentWave: 2,
      maxWaves: 3,
      bossHp: 35000,
      bossMaxHp: 50000,
      participants: generateParticipants(5, 'normal'),
      combatLog: [
        { timestamp: Date.now() - 120000, message: 'Raid started', type: 'phase' }
      ],
      lootDrops: [],
      startedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 180000)),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const raid2 = await db.collection('raidInstances').add({
      raidId: 'dragons_lair',
      difficulty: 'heroic',
      status: 'in-progress',
      currentWave: 5,
      maxWaves: 5,
      bossHp: 75000,
      bossMaxHp: 150000,
      participants: generateParticipants(8, 'heroic'),
      combatLog: [],
      lootDrops: [],
      startedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 300000)),
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Create world boss with 50 participants
    const worldBoss = await db.collection('worldBoss').add({
      name: 'Void Emperor',
      hp: 650000,
      maxHp: 1000000,
      attack: 300,
      level: 60,
      mechanics: [
        'Void Beam', 'Reality Tear', 'Consuming Darkness', 'Entropy'
      ],
      scheduledTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 600000)),
      duration: 60,
      rewards: {
        gold: 5000,
        tokens: 100,
        guaranteedLoot: 'legendary',
        xpBonus: 50000
      },
      participants: generateParticipants(50, 'mythic'),
      status: 'active',
      startedAt: Date.now() - 600000,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.json({
      success: true,
      message: 'Test data created!',
      data: {
        raid1: raid1.id,
        raid2: raid2.id,
        worldBoss: worldBoss.id
      }
    });
  } catch (error) {
    console.error('Error creating test data:', error);
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Import WebSocket server
import { initializeWebSocketServer, initializeTwitchEventHandlers } from './websocket/server.js';
import { setupKeepalive } from './websocket/rooms.js';

// Start server
// Debug: Log all registered routes (including login reward routes)
if (process.env.NODE_ENV !== 'production') {
  console.log('\n📋 Registered Routes:');
  const printRoutes = (stack, prefix = '') => {
    stack.forEach((layer) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
        const fullPath = prefix + layer.route.path;
        console.log(`  ${methods.padEnd(6)} ${fullPath}`);
      } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
        // Extract the mount path from the regex
        const mountPath = layer.regexp.source
          .replace('\\/?', '')
          .replace('(?=\\/|$)', '')
          .replace(/\\\//g, '/')
          .replace(/\\\^/g, '^')
          .replace(/\\\$/g, '$')
          .replace(/\(/g, '')
          .replace(/\)/g, '')
          .replace(/\?/g, '');
        const newPrefix = prefix + (mountPath || '/');
        printRoutes(layer.handle.stack, newPrefix);
      }
    });
  };
  printRoutes(app._router.stack);
  console.log('');
}

const server = app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════╗
║   The Never Ending War - Backend API      ║
╚════════════════════════════════════════════╝

🚀 Server running on: http://localhost:${PORT}
🔥 Firebase: Connected
📡 Environment: ${process.env.NODE_ENV || 'development'}

API Endpoints:
  GET    /api/health
  
  Auth:
  POST   /api/auth/twitch
  GET    /api/auth/me
  
  Heroes:
  GET    /api/heroes
  GET    /api/heroes/:userId
  POST   /api/heroes/create
  PUT    /api/heroes/:userId
  GET    /api/heroes/login-reward/:userId/status
  POST   /api/heroes/login-reward/:userId
  
  Professions:
  POST   /api/professions/:userId/profession
  POST   /api/professions/:userId/craft
  POST   /api/professions/:userId/apply
  
  Guilds:
  GET    /api/guilds
  POST   /api/guilds
  
  Raids:
  GET    /api/raids/available/:userId
  POST   /api/raids/:raidId/start
  POST   /api/raids/instance/:instanceId/progress
  POST   /api/raids/instance/:instanceId/complete
  GET    /api/raids/instance/:instanceId/status
  
  World Boss:
  GET    /api/worldboss/active
  POST   /api/worldboss/:bossId/join
  POST   /api/worldboss/:bossId/damage
  GET    /api/worldboss/:bossId/leaderboard
  
  Quests:
  GET    /api/quests/daily
  GET    /api/quests/weekly
  GET    /api/quests/monthly
  GET    /api/quests/:userId/progress
  POST   /api/quests/:userId/claim/:questId
  POST   /api/quests/:userId/claim-bonus/:type
  POST   /api/quests/:userId/update/:questId
  
  Bits:
  POST   /api/bits/purchase

Press Ctrl+C to stop
  `);
  
  // Initialize quest system
  initializeQuestSystem().catch(err => {
    console.error('❌ Failed to initialize quest system:', err);
  });
  
  // Initialize WebSocket server
  const wss = initializeWebSocketServer(server);
  if (wss) {
    setupKeepalive(wss);
    initializeTwitchEventHandlers();
  }
});

// Export for Firebase Functions (optional)
export { app, db };
