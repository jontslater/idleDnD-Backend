import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Calculate hero strength (level + gear score)
function calculateHeroStrength(hero) {
  const level = hero.level || 1;
  
  // Calculate gear score
  let gearScore = 0;
  if (hero.equipment) {
    Object.values(hero.equipment).forEach(item => {
      if (item) {
        gearScore += (item.attack || 0) + (item.defense || 0) + (item.hp || 0);
      }
    });
  }
  
  // Total strength = level * 100 + gear score
  return (level * 100) + gearScore;
}

async function findAndAddStrongestHero() {
  try {
    const battlefieldId = 'twitch:1087777297';
    
    console.log('\n🔍 Searching for all heroes in Firebase...\n');
    
    // Get ALL heroes (no filter)
    const allHeroesSnapshot = await db.collection('heroes').get();
    
    if (allHeroesSnapshot.empty) {
      console.log('❌ No heroes found in Firebase!');
      process.exit(0);
    }
    
    console.log(`✅ Found ${allHeroesSnapshot.size} total heroes\n`);
    
    // Group heroes by user (twitchUserId)
    const heroesByUser = new Map();
    
    allHeroesSnapshot.forEach(doc => {
      const hero = doc.data();
      
      // Skip test heroes
      if (hero.name && hero.name.startsWith('Test')) {
        return;
      }
      
      // Skip heroes without a twitch user ID
      if (!hero.twitchUserId) {
        console.log(`⚠️ Skipping ${hero.name} - no twitchUserId`);
        return;
      }
      
      const strength = calculateHeroStrength(hero);
      
      const heroData = {
        id: doc.id,
        name: hero.name,
        level: hero.level || 1,
        role: hero.role || 'Unknown',
        twitchUsername: hero.twitchUsername,
        twitchUserId: hero.twitchUserId,
        currentBattlefieldId: hero.currentBattlefieldId || null,
        strength: strength,
        equipment: hero.equipment || {}
      };
      
      // Group by twitchUserId
      if (!heroesByUser.has(hero.twitchUserId)) {
        heroesByUser.set(hero.twitchUserId, []);
      }
      heroesByUser.get(hero.twitchUserId).push(heroData);
    });
    
    console.log(`👥 Found ${heroesByUser.size} unique users\n`);
    
    // Find strongest hero for each user
    const strongestPerUser = [];
    
    heroesByUser.forEach((heroes, userId) => {
      // Sort by strength and pick the strongest
      heroes.sort((a, b) => b.strength - a.strength);
      const strongest = heroes[0];
      
      strongestPerUser.push({
        ...strongest,
        userHeroCount: heroes.length
      });
      
      if (heroes.length > 1) {
        console.log(`${strongest.twitchUsername}: ${heroes.length} heroes, strongest is ${strongest.name} (Lv${strongest.level}, Strength: ${strongest.strength})`);
      }
    });
    
    // Sort by strength (descending)
    strongestPerUser.sort((a, b) => b.strength - a.strength);
    
    console.log(`\n📊 Top 10 Strongest Heroes (one per user):\n`);
    strongestPerUser.slice(0, 10).forEach((hero, index) => {
      const onBattlefield = hero.currentBattlefieldId === battlefieldId ? ' ✅ ON BATTLEFIELD' : '';
      console.log(`${index + 1}. ${hero.name} (${hero.role}, Lv${hero.level}) - Strength: ${hero.strength}${onBattlefield}`);
      console.log(`   User: ${hero.twitchUsername || 'N/A'} (${hero.userHeroCount} total heroes)`);
      console.log('');
    });
    
    // Find heroes NOT on the battlefield
    const heroesToAdd = strongestPerUser.filter(h => h.currentBattlefieldId !== battlefieldId);
    
    if (heroesToAdd.length === 0) {
      console.log('✅ All users\' strongest heroes are already on the battlefield!');
      process.exit(0);
    }
    
    console.log(`\n🏆 Found ${heroesToAdd.length} strongest heroes NOT on battlefield\n`);
    
    // Add all strongest heroes to battlefield
    console.log('📝 Adding heroes to battlefield...\n');
    
    for (const hero of heroesToAdd) {
      console.log(`  Adding: ${hero.name} (${hero.twitchUsername}) - Lv${hero.level}`);
      
      await db.collection('heroes').doc(hero.id).update({
        currentBattlefieldId: battlefieldId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log(`\n✅ Added ${heroesToAdd.length} heroes to the battlefield!`);
    
    // Show updated battlefield roster
    console.log('\n\n📋 Current Battlefield Roster:\n');
    const battlefieldHeroes = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    // Group by user for display
    const battlefieldByUser = new Map();
    battlefieldHeroes.forEach(doc => {
      const hero = doc.data();
      const userId = hero.twitchUserId || 'Unknown';
      if (!battlefieldByUser.has(userId)) {
        battlefieldByUser.set(userId, []);
      }
      battlefieldByUser.get(userId).push(hero);
    });
    
    battlefieldByUser.forEach((heroes, userId) => {
      heroes.forEach(hero => {
        console.log(`  - ${hero.name} (${hero.role}, Lv${hero.level}) - User: ${hero.twitchUsername || 'Unknown'}`);
      });
    });
    
    console.log(`\n✅ Total heroes on battlefield: ${battlefieldHeroes.size}`);
    console.log(`✅ Total users represented: ${battlefieldByUser.size}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

findAndAddStrongestHero();
