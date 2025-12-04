import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateRaidStructure() {
  try {
    console.log('\n🔧 Updating raid structure to match expected format...\n');
    
    const batch = db.batch();
    
    // Elder Dragon Mythic
    const elderDragonRef = db.collection('raids').doc('elder_dragon_mythic');
    batch.update(elderDragonRef, {
      boss: {
        name: 'Elder Dragon',
        level: 90,
        hp: 500000,
        maxHp: 500000,
        attack: 500,
        mechanics: ['Fire Breath', 'Tail Swipe', 'Wing Buffet', 'Aerial Assault']
      }
    });
    
    // Molten Core
    const moltenCoreRef = db.collection('raids').doc('molten_core');
    batch.update(moltenCoreRef, {
      boss: {
        name: 'Magma Lord',
        level: 60,
        hp: 250000,
        maxHp: 250000,
        attack: 300,
        mechanics: ['Lava Pool', 'Eruption', 'Molten Armor']
      }
    });
    
    // Dragon Sanctum
    const dragonSanctumRef = db.collection('raids').doc('dragon_sanctum');
    batch.update(dragonSanctumRef, {
      boss: {
        name: 'Ancient Dragon',
        level: 70,
        hp: 350000,
        maxHp: 350000,
        attack: 400,
        mechanics: ['Flame Breath', 'Dragon Roar', 'Dive Bomb']
      }
    });
    
    console.log('✅ Updating Elder Dragon Lair');
    console.log('✅ Updating Molten Core');
    console.log('✅ Updating Dragon Sanctum');
    
    await batch.commit();
    
    console.log('\n🎉 All raids updated with boss data!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

updateRaidStructure();
