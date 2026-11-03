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
    
    console.log('\n🎉 All quests regenerated successfully!');
    console.log('ℹ️  Player quest progress resets lazily via periodKey on next login/combat sync.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error regenerating quests:', error);
    process.exit(1);
  }
}

regenerateAllQuests();
