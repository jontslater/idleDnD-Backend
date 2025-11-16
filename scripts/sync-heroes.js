import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase
try {
  const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountContent);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Transform Electron save data to Firebase format
 */
function transformHeroData(heroData) {
  // Ensure required fields have defaults
  const transformed = {
    name: heroData.name || 'Unknown Hero',
    twitchUserId: heroData.twitchUserId || heroData.userId || '',
    tiktokUserId: heroData.tiktokUserId || null,
    role: heroData.role || 'berserker',
    level: heroData.level || 1,
    hp: heroData.hp || 100,
    maxHp: heroData.maxHp || 100,
    xp: heroData.xp || 0,
    maxXp: heroData.maxXp || 100,
    attack: heroData.attack || 10,
    defense: heroData.defense || 5,
    gold: heroData.gold || 0,
    tokens: heroData.tokens || 0,
    totalIdleTokens: heroData.totalIdleTokens || 0,
    lastTokenClaim: heroData.lastTokenClaim || Date.now(),
    lastCommandTime: heroData.lastCommandTime || Date.now(),
    equipment: {
      weapon: heroData.equipment?.weapon || null,
      armor: heroData.equipment?.armor || null,
      accessory: heroData.equipment?.accessory || null,
      shield: heroData.equipment?.shield || null
    },
    stats: {
      totalDamage: heroData.stats?.totalDamage || 0,
      totalHealing: heroData.stats?.totalHealing || 0,
      damageBlocked: heroData.stats?.damageBlocked || 0
    },
    isDead: heroData.isDead || false,
    deathTime: heroData.deathTime || null,
    potions: {
      health: heroData.potions?.health || 0
    },
    activeBuffs: heroData.activeBuffs || {},
    profession: heroData.profession || null,
    joinedAt: heroData.joinedAt || Date.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  return transformed;
}

/**
 * Sync a single hero to Firebase
 */
async function syncHero(heroData, options = {}) {
  try {
    const transformed = transformHeroData(heroData);
    
    // Validate required fields
    if (!transformed.twitchUserId) {
      console.warn(`⚠️  Skipping hero "${transformed.name}" - missing twitchUserId`);
      return { success: false, reason: 'missing_twitch_id' };
    }

    // Check if hero already exists
    const existingHero = await db.collection('heroes')
      .where('twitchUserId', '==', transformed.twitchUserId)
      .limit(1)
      .get();

    if (!existingHero.empty) {
      if (options.overwrite) {
        // Update existing hero
        const docId = existingHero.docs[0].id;
        await db.collection('heroes').doc(docId).update({
          ...transformed,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Updated hero: ${transformed.name} (${transformed.twitchUserId})`);
        return { success: true, action: 'updated', id: docId };
      } else {
        console.log(`⏭️  Skipping existing hero: ${transformed.name} (${transformed.twitchUserId})`);
        return { success: false, reason: 'already_exists' };
      }
    }

    // Create new hero
    const docRef = await db.collection('heroes').add(transformed);
    console.log(`✅ Created hero: ${transformed.name} (${transformed.twitchUserId}) - ID: ${docRef.id}`);
    return { success: true, action: 'created', id: docRef.id };
  } catch (error) {
    console.error(`❌ Error syncing hero:`, error);
    return { success: false, reason: 'error', error: error.message };
  }
}

/**
 * Main sync function
 */
async function syncHeroes(saveFilePath, options = {}) {
  console.log('\n🔄 Starting hero sync...\n');
  
  try {
    // Read save file
    const saveData = JSON.parse(readFileSync(saveFilePath, 'utf8'));
    
    let heroes = [];
    
    // Handle different save file formats
    if (Array.isArray(saveData)) {
      heroes = saveData;
    } else if (saveData.heroes && Array.isArray(saveData.heroes)) {
      heroes = saveData.heroes;
    } else if (typeof saveData === 'object') {
      // If it's an object with hero IDs as keys
      heroes = Object.values(saveData);
    }

    if (heroes.length === 0) {
      console.log('⚠️  No heroes found in save file');
      return;
    }

    console.log(`📊 Found ${heroes.length} hero(es) to sync\n`);

    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0
    };

    // Sync each hero
    for (const heroData of heroes) {
      const result = await syncHero(heroData, options);
      
      if (result.success) {
        if (result.action === 'created') results.created++;
        if (result.action === 'updated') results.updated++;
      } else {
        if (result.reason === 'already_exists') results.skipped++;
        else results.errors++;
      }
    }

    console.log('\n📈 Sync Summary:');
    console.log(`   ✅ Created: ${results.created}`);
    console.log(`   🔄 Updated: ${results.updated}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ❌ Errors: ${results.errors}`);
    console.log('\n✨ Sync complete!\n');
  } catch (error) {
    console.error('❌ Failed to read or parse save file:', error);
    process.exit(1);
  }
}

/**
 * Create a test hero (for testing purposes)
 */
async function createTestHero() {
  const testHero = {
    name: 'TestHero',
    twitchUserId: 'test_user_' + Date.now(),
    role: 'berserker',
    level: 5,
    hp: 150,
    maxHp: 150,
    xp: 50,
    maxXp: 200,
    attack: 25,
    defense: 15,
    gold: 100,
    tokens: 5,
    equipment: {
      weapon: {
        name: 'Iron Sword',
        attack: 15,
        rarity: 'common'
      },
      armor: null,
      accessory: null,
      shield: null
    }
  };

  const result = await syncHero(testHero);
  if (result.success) {
    console.log('\n✅ Test hero created successfully!');
    console.log(`   ID: ${result.id}`);
    console.log(`   Twitch User ID: ${testHero.twitchUserId}`);
  }
}

// CLI handling
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    Hero Sync Script                            ║
╚════════════════════════════════════════════════════════════════╝

Usage:
  node scripts/sync-heroes.js <save-file-path> [options]
  node scripts/sync-heroes.js --test

Options:
  --overwrite    Overwrite existing heroes (default: skip)
  --test         Create a test hero

Examples:
  # Sync heroes from Electron save file
  node scripts/sync-heroes.js E:\\IdleDnD\\save-data.json

  # Sync and overwrite existing heroes
  node scripts/sync-heroes.js E:\\IdleDnD\\save-data.json --overwrite

  # Create a test hero
  node scripts/sync-heroes.js --test

Note: The save file should contain hero data in JSON format.
  Expected formats:
  - Array of heroes: [{ hero1 }, { hero2 }, ...]
  - Object with heroes key: { heroes: [{ hero1 }, ...] }
  - Object with hero IDs: { "userId1": { hero1 }, "userId2": { hero2 }, ... }
`);
  process.exit(0);
}

// Handle --test flag
if (args[0] === '--test') {
  createTestHero()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
} else {
  const saveFilePath = args[0];
  const options = {
    overwrite: args.includes('--overwrite')
  };

  syncHeroes(saveFilePath, options)
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

