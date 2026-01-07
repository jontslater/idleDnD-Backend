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
  
  // Initialize write batcher to reduce Firestore quota usage
  const { getWriteBatcher } = await import('./utils/writeBatcher.js');
  const writeBatcher = getWriteBatcher(db);
  console.log('✅ Write batcher initialized (reduces Firestore writes)');
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

// Stripe webhook needs raw body - handle it before bodyParser
app.post('/api/purchases/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  // Import Stripe and purchases route handler here to avoid circular dependency
  const Stripe = (await import('stripe')).default;
  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const purchaseId = session.metadata?.purchaseId;

    if (!purchaseId) {
      console.error('[Stripe Webhook] No purchaseId in session metadata');
      return res.status(400).json({ error: 'No purchaseId in session metadata' });
    }

    console.log(`[Stripe Webhook] Payment completed for purchase: ${purchaseId}`);

    try {
      // Get purchase record
      const purchaseRef = db.collection('purchases').doc(purchaseId);
      const purchaseDoc = await purchaseRef.get();

      if (!purchaseDoc.exists) {
        console.error(`[Stripe Webhook] Purchase ${purchaseId} not found`);
        return res.status(404).json({ error: 'Purchase not found' });
      }

      const purchase = purchaseDoc.data();

      if (purchase.status === 'completed') {
        console.log(`[Stripe Webhook] Purchase ${purchaseId} already completed`);
        return res.json({ received: true, message: 'Purchase already completed' });
      }

      // Import PACK_TIERS, TOKEN_PACKS, and TIER_LEVELS from purchases route
      // For now, we'll use a simpler approach - call the complete endpoint
      // Update purchase status
      await purchaseRef.update({
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        stripeSessionId: session.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Complete the purchase based on type (call existing complete endpoints via internal logic)
      if (purchase.packTier) {
        // Complete founders pack
        const PACK_TIERS = {
          bronze: { price: 5, premiumCurrency: 25, name: 'Bronze Founder' },
          silver: { price: 10, premiumCurrency: 75, name: 'Silver Founder' },
          gold: { price: 15, premiumCurrency: 150, name: 'Gold Founder' },
          platinum: { price: 25, premiumCurrency: 250, name: 'Platinum Founder' }
        };
        const TIER_LEVELS = { bronze: 1, silver: 2, gold: 3, platinum: 4 };
        
        const heroesSnapshot = await db.collection('heroes')
          .where('twitchUserId', '==', purchase.userId)
          .get();

        if (!heroesSnapshot.empty) {
          const packConfig = PACK_TIERS[purchase.packTier];
          const tierLevel = TIER_LEVELS[purchase.packTier];
          const batch = db.batch();

          heroesSnapshot.docs.forEach(heroDoc => {
            const heroRef = db.collection('heroes').doc(heroDoc.id);
            const hero = heroDoc.data();
            
            // Build hero update with founder pack benefits
            const heroUpdate = {
              founderPackTier: purchase.packTier,
              founderPackTierLevel: tierLevel, // Fixed: use founderPackTierLevel (not founderPackLevel)
              tokens: (hero.tokens || 0) + packConfig.premiumCurrency,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Auto-unlock founder title if not already unlocked
            if (!hero.unlockedTitles || !hero.unlockedTitles.includes('Founder')) {
              heroUpdate.unlockedTitles = admin.firestore.FieldValue.arrayUnion('Founder');
              // Set as active title if no title is currently selected
              if (!hero.activeTitle) {
                heroUpdate.activeTitle = 'Founder';
              }
            }

            batch.update(heroRef, heroUpdate);
          });

          await batch.commit();
          console.log(`[Stripe Webhook] Founders pack ${purchase.packTier} completed for user ${purchase.userId} - updated ${heroesSnapshot.docs.length} heroes`);
        }
      } else if (purchase.packType && purchase.heroId) {
        // Complete token pack
        const TOKEN_PACKS = {
          impulse: { price: 0.99, tokens: 100, gold: 1000, name: 'Impulse Pack' },
          starter: { price: 4.99, tokens: 500, gold: 5000, name: 'Starter Pack' },
          value: { price: 9.99, tokens: 1500, gold: 15000, name: 'Value Pack' },
          premium: { price: 24.99, tokens: 5000, gold: 50000, name: 'Premium Pack' }
        };
        
        const packConfig = TOKEN_PACKS[purchase.packType];
        const heroRef = db.collection('heroes').doc(purchase.heroId);
        const heroDoc = await heroRef.get();

        if (heroDoc.exists) {
          const hero = heroDoc.data();
          await heroRef.update({
            tokens: (hero.tokens || 0) + packConfig.tokens,
            gold: (hero.gold || 0) + packConfig.gold,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[Stripe Webhook] Token pack ${purchase.packType} completed for hero ${purchase.heroId}`);
        }
      }

      res.json({ received: true, message: 'Purchase completed successfully' });
    } catch (error) {
      console.error('[Stripe Webhook] Error completing purchase:', error);
      res.status(500).json({ error: 'Failed to complete purchase', details: error.message });
    }
  } else {
    res.json({ received: true });
  }
});

// Then apply JSON body parser for all other routes
// Increased limit to 2MB to handle large batch quest updates and other large payloads
app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));

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
import streamSettingsRoutes from './routes/streamSettings.js';
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
app.use('/api/stream/settings', streamSettingsRoutes);

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

  // Initialize periodic chat updates service
  // Can be disabled by setting ENABLE_PERIODIC_UPDATES=false
  const periodicUpdatesEnabled = process.env.ENABLE_PERIODIC_UPDATES !== 'false';
  if (periodicUpdatesEnabled) {
    try {
      const { initializePeriodicChatUpdates } = await import('./services/periodicChatUpdates.js');
      const updateInterval = process.env.CHAT_UPDATE_INTERVAL_MINUTES 
        ? parseInt(process.env.CHAT_UPDATE_INTERVAL_MINUTES, 10) 
        : 7; // Default to 7 minutes (matches default in streamSettings)
      initializePeriodicChatUpdates(updateInterval);
      console.log(`[Periodic Updates] ✅ Service initialized with ${updateInterval} minute interval`);
    } catch (error) {
      console.error('❌ Failed to initialize periodic chat updates:', error);
    }
  } else {
    console.log('[Periodic Updates] ⏸️ Disabled via ENABLE_PERIODIC_UPDATES=false');
  }
  
  // Initialize XP accumulator service (reduces API calls for enemy kills)
  try {
    const { initializeXPAccumulator } = await import('./services/xpAccumulatorService.js');
    const xpInterval = process.env.XP_AWARD_INTERVAL_MS 
      ? parseInt(process.env.XP_AWARD_INTERVAL_MS, 10) 
      : null; // Use default (30 seconds) if not set
    initializeXPAccumulator(xpInterval);
    console.log('✅ XP accumulator service initialized (reduces API calls for enemy kills)');
  } catch (error) {
    console.error('❌ Failed to initialize XP accumulator service:', error);
  }
});

// Export for Firebase Functions (optional)
export { app, db };
