/**
 * Create a test party of heroes for testing the raid system
 * Creates 4 heroes that join theneverendingwar's battlefield
 * Run: node create-test-party.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createTestParty() {
  try {
    console.log('Creating test party for raid testing...\n');
    
    const battlefieldId = 'twitch:1087777297'; // theneverendingwar's battlefield
    
    const testHeroes = [
      {
        name: 'TestTank',
        username: 'testtank',
        role: 'guardian', // Tank
        level: 80,
        hp: 12000,
        maxHp: 12000,
        attack: 450,
        defense: 1200,
        xp: 0,
        maxXp: 10000,
        gold: 50000,
        twitchUserId: 'test_tank_001',
        currentBattlefieldId: battlefieldId,
        equipment: {
          weapon: { name: 'Legendary Sword', rarity: 'legendary', attack: 100, defense: 50, hp: 200 },
          armor: { name: 'Legendary Plate', rarity: 'legendary', attack: 0, defense: 200, hp: 500 },
          shield: { name: 'Legendary Shield', rarity: 'legendary', attack: 0, defense: 300, hp: 400 }
        },
        skills: { ironSkin: 5, shieldWall: 5, taunt: 5 },
        autoBuy: false
      },
      {
        name: 'TestHealer',
        username: 'testhealer',
        role: 'shaman', // Healer - Spirit Healer
        level: 78,
        hp: 8000,
        maxHp: 8000,
        attack: 350,
        defense: 600,
        intellect: 80,
        wisdom: 90,
        healingPower: 25,
        xp: 0,
        maxXp: 10000,
        gold: 50000,
        twitchUserId: 'test_healer_001',
        currentBattlefieldId: battlefieldId,
        equipment: {
          weapon: { name: 'Legendary Staff', rarity: 'legendary', attack: 80, defense: 40, hp: 300 },
          armor: { name: 'Legendary Robes', rarity: 'legendary', attack: 0, defense: 150, hp: 400 }
        },
        skills: { divineGrace: 5, blessed: 5, restoration: 5 },
        autoBuy: false
      },
      {
        name: 'TestDPS1',
        username: 'testdps1',
        role: 'berserker', // DPS
        level: 82,
        hp: 9000,
        maxHp: 9000,
        attack: 800,
        defense: 500,
        xp: 0,
        maxXp: 10000,
        gold: 50000,
        twitchUserId: 'test_dps1_001',
        currentBattlefieldId: battlefieldId,
        equipment: {
          weapon: { name: 'Legendary Axe', rarity: 'legendary', attack: 200, defense: 20, hp: 150 },
          gloves: { name: 'Legendary Gauntlets', rarity: 'legendary', attack: 150, defense: 80, hp: 200 }
        },
        skills: { criticalStrike: 5, rage: 5, execute: 5 },
        autoBuy: false
      },
      {
        name: 'TestDPS2',
        username: 'testdps2',
        role: 'mage', // DPS
        level: 79,
        hp: 7500,
        maxHp: 7500,
        attack: 750,
        defense: 400,
        intellect: 85,
        xp: 0,
        maxXp: 10000,
        gold: 50000,
        twitchUserId: 'test_dps2_001',
        currentBattlefieldId: battlefieldId,
        equipment: {
          weapon: { name: 'Legendary Wand', rarity: 'legendary', attack: 180, defense: 30, hp: 100 },
          accessory: { name: 'Legendary Amulet', rarity: 'legendary', attack: 120, defense: 60, hp: 250 }
        },
        skills: { arcaneBlast: 5, fireball: 5, frostNova: 5 },
        autoBuy: false
      }
    ];
    
    const createdHeroes = [];
    
    for (const heroData of testHeroes) {
      const heroRef = await db.collection('heroes').add({
        ...heroData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`✅ Created ${heroData.name} (${heroData.role}, Lv${heroData.level}) - ID: ${heroRef.id}`);
      createdHeroes.push({ id: heroRef.id, ...heroData });
    }
    
    console.log('\n🎉 Test party created successfully!');
    console.log('\n📋 Party Composition:');
    console.log('1. theneverendingwar (guardian, Lv83) - STREAMER');
    console.log(`2. TestTank (guardian, Lv80) - ${createdHeroes[0].id}`);
    console.log(`3. TestHealer (shaman, Lv78) - ${createdHeroes[1].id}`);
    console.log(`4. TestDPS1 (berserker, Lv82) - ${createdHeroes[2].id}`);
    console.log(`5. TestDPS2 (mage, Lv79) - ${createdHeroes[3].id}`);
    
    console.log('\n📍 All heroes are on battlefield:', battlefieldId);
    console.log('\n🔧 Next step: Run create-high-level-raid.js to start the raid!');
    
    return createdHeroes;
  } catch (error) {
    console.error('❌ Error creating test party:', error);
    throw error;
  }
}

createTestParty()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
