import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateQuests } from '../src/services/questService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin (check if already initialized)
let db;

try {
  // Try to get existing app
  db = admin.app().firestore();
  console.log('✅ Using existing Firebase instance');
} catch (error) {
  // If no app exists, initialize it
  const serviceAccount = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, '../serviceAccountKey.json'), 'utf8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  db = admin.firestore();
  console.log('✅ Firebase initialized');
}

async function regenerateAllQuests() {
  console.log('🔄 Regenerating all quests...\n');
  
  try {
    // Generate new daily quests
    console.log('📜 Generating daily quests...');
    const dailyQuests = await generateQuests('daily');
    console.log(`✅ Generated ${dailyQuests.quests.length} daily quests`);
    dailyQuests.quests.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.name} - ${q.description} (${q.tier})`);
    });
    console.log('');
    
    // Generate new weekly quests
    console.log('📜 Generating weekly quests...');
    const weeklyQuests = await generateQuests('weekly');
    console.log(`✅ Generated ${weeklyQuests.quests.length} weekly quests`);
    weeklyQuests.quests.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.name} - ${q.description} (${q.tier})`);
    });
    console.log('');
    
    // Generate new monthly quests
    console.log('📜 Generating monthly quests...');
    const monthlyQuests = await generateQuests('monthly');
    console.log(`✅ Generated ${monthlyQuests.quests.length} monthly quests`);
    monthlyQuests.quests.forEach((q, i) => {
      console.log(`   ${i + 1}. ${q.name} - ${q.description} (${q.tier})`);
    });
    console.log('');
    
    // Reset all player quest progress
    console.log('🔄 Resetting all player quest progress...');
    const heroesSnapshot = await db.collection('heroes').get();
    const batch = db.batch();
    
    heroesSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        'questProgress.daily': {},
        'questProgress.weekly': {},
        'questProgress.monthly': {},
        'questProgress.dailyBonusClaimed': false,
        'questProgress.weeklyBonusClaimed': false,
        'questProgress.monthlyBonusClaimed': false,
        'questProgress.lastDailyReset': admin.firestore.FieldValue.serverTimestamp(),
        'questProgress.lastWeeklyReset': admin.firestore.FieldValue.serverTimestamp(),
        'questProgress.lastMonthlyReset': admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log(`✅ Reset ${heroesSnapshot.size} players' quest progress`);
    
    console.log('\n🎉 All quests regenerated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error regenerating quests:', error);
    process.exit(1);
  }
}

regenerateAllQuests();
