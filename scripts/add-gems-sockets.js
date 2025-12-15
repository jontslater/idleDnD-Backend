/**
 * Script to add gems and socket items to a user's hero for testing
 * Usage: node scripts/add-gems-sockets.js theneverendingwar
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

// Generate gem stats (matches backend logic)
function generateGemStats(type, rarity) {
  const rarityMultipliers = {
    common: 1,
    uncommon: 2,
    rare: 4,
    epic: 8,
    legendary: 16
  };
  
  const multiplier = rarityMultipliers[rarity] || 1;
  const stats = {};
  
  if (type === 'ruby') {
    stats.attack = Math.floor(10 * multiplier);
    stats.critChance = Math.floor(2 * multiplier);
    stats.critDamage = Math.floor(5 * multiplier);
  } else if (type === 'sapphire') {
    stats.defense = Math.floor(10 * multiplier);
    stats.maxHp = Math.floor(50 * multiplier);
    stats.damageReduction = Math.floor(1 * multiplier);
  } else if (type === 'emerald') {
    stats.attack = Math.floor(5 * multiplier);
    stats.defense = Math.floor(5 * multiplier);
    stats.maxHp = Math.floor(25 * multiplier);
    stats.critChance = Math.floor(1 * multiplier);
  } else if (type === 'diamond') {
    stats.xpGain = Math.floor(5 * multiplier);
    stats.goldGain = Math.floor(5 * multiplier);
    stats.tokenGain = Math.floor(2 * multiplier);
  }
  
  return stats;
}

async function addGemsAndSockets(username) {
  try {
    console.log(`\n🔍 Looking for hero: ${username}...`);
    
    const hero = await findHeroByUsername(username);
    
    if (!hero) {
      console.error(`❌ Hero not found for username: ${username}`);
      process.exit(1);
    }
    
    console.log(`✅ Found hero: ${hero.name} (ID: ${hero.docId})`);
    console.log(`📦 Current inventory size: ${(hero.inventory || []).length}`);
    
    const heroRef = db.collection('heroes').doc(hero.docId);
    const currentInventory = hero.inventory || [];
    
    // Generate gems of different types and rarities
    const gemsToAdd = [];
    const gemTypes = ['ruby', 'sapphire', 'emerald', 'diamond'];
    const gemRarities = ['common', 'uncommon', 'rare', 'epic'];
    
    // Add 2 of each gem type with various rarities
    gemTypes.forEach((type, typeIdx) => {
      gemRarities.forEach((rarity, rarityIdx) => {
        for (let i = 0; i < 2; i++) {
          const gemId = `gem_${Date.now()}_${typeIdx}_${rarityIdx}_${i}`;
          const stats = generateGemStats(type, rarity);
          
          gemsToAdd.push({
            id: gemId,
            name: `${type.charAt(0).toUpperCase() + type.slice(1)} Gem (${rarity.charAt(0).toUpperCase() + rarity.slice(1)})`,
            type: type,
            rarity: rarity,
            color: type === 'ruby' ? '#dc2626' : type === 'sapphire' ? '#2563eb' : type === 'emerald' ? '#16a34a' : '#fbbf24',
            stats: stats,
            purchasedAt: admin.firestore.Timestamp.now()
          });
        }
      });
    });
    
    // Add 10 Gem Socket items
    const socketItemsToAdd = [];
    for (let i = 0; i < 10; i++) {
      const socketId = `socket_${Date.now()}_${i}`;
      socketItemsToAdd.push({
        id: socketId,
        name: 'Gem Socket',
        type: 'socket',
        rarity: 'uncommon',
        description: 'Adds a socket to a piece of gear',
        purchasedAt: admin.firestore.Timestamp.now()
      });
    }
    
    // Combine all items
    const itemsToAdd = [...gemsToAdd, ...socketItemsToAdd];
    
    // Update hero inventory
    const updatedInventory = [...currentInventory, ...itemsToAdd];
    
    await heroRef.update({
      inventory: updatedInventory
    });
    
    console.log(`\n✅ Added to inventory:`);
    console.log(`   - ${gemsToAdd.length} gems (${gemTypes.length} types × ${gemRarities.length} rarities × 2 each)`);
    console.log(`   - ${socketItemsToAdd.length} Gem Socket items`);
    console.log(`📦 New inventory size: ${updatedInventory.length}`);
    console.log(`\n🎉 Done! The hero now has gems and sockets for testing.`);
    
  } catch (error) {
    console.error('❌ Error adding gems and sockets:', error);
    process.exit(1);
  }
}

// Get username from command line arguments
const username = process.argv[2] || 'theneverendingwar';

addGemsAndSockets(username);








