/**
 * Migration Script: Fix Equipment Slots for All Heroes
 * 
 * This script initializes missing equipment slots for all existing heroes in the database.
 * Similar to how quest progress is initialized, this ensures all heroes have proper
 * equipment slot structure.
 * 
 * Run once to fix existing heroes, then can be deleted.
 * 
 * Usage: node scripts/fix-equipment-slots.js
 */

import admin from 'firebase-admin';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeEquipmentSlots } from '../src/services/gearService.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
try {
  const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  
  if (!admin.apps.length) {
    initializeApp({
      credential: cert(serviceAccount)
    });
  }
  
  const db = getFirestore();
  
  console.log('🔧 Starting equipment slot migration...\n');
  
  // Get all heroes
  const heroesSnapshot = await db.collection('heroes').get();
  console.log(`📊 Found ${heroesSnapshot.size} heroes to check\n`);
  
  let fixed = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const heroDoc of heroesSnapshot.docs) {
    try {
      const hero = { id: heroDoc.id, ...heroDoc.data() };
      
      if (!hero.role) {
        console.log(`⚠️  Skipping hero ${hero.id} - no role defined`);
        skipped++;
        continue;
      }
      
      const initializedEquipment = initializeEquipmentSlots(hero);
      
      if (!initializedEquipment) {
        console.log(`⚠️  Skipping hero ${hero.id} - could not initialize equipment`);
        skipped++;
        continue;
      }
      
      // Check if equipment needs updating
      const currentSlots = Object.keys(hero.equipment || {});
      const expectedSlots = Object.keys(initializedEquipment);
      const needsUpdate = expectedSlots.some(slot => !(slot in (hero.equipment || {})));
      
      if (needsUpdate) {
        await heroDoc.ref.update({ equipment: initializedEquipment });
        console.log(`✅ Fixed hero ${hero.id} (${hero.name || 'unnamed'}) - ${hero.role}`);
        console.log(`   Added slots: ${expectedSlots.filter(s => !currentSlots.includes(s)).join(', ')}`);
        fixed++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`❌ Error processing hero ${heroDoc.id}:`, error.message);
      errors++;
    }
  }
  
  console.log(`\n📊 Migration Summary:`);
  console.log(`   ✅ Fixed: ${fixed}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`\n✨ Migration complete!`);
  
  process.exit(0);
} catch (error) {
  console.error('❌ Fatal error:', error);
  process.exit(1);
}
