import admin from 'firebase-admin';
import { db } from '../index.js';
import { 
  generateDynamicQuests, 
  generateCompletionBonus 
} from './dynamicQuestGenerator.js';

// In-memory cache for quests to reduce Firestore reads
const questCache = {
  daily: { data: null, expiresAt: null },
  weekly: { data: null, expiresAt: null },
  monthly: { data: null, expiresAt: null }
};

// Cache TTL: 5 minutes (quests only change on reset, so this is safe)
const CACHE_TTL_MS = 5 * 60 * 1000;

// Get next reset time for each quest type
export function getNextResetTime(type) {
  const now = new Date();
  let resetDate = new Date();
  
  if (type === 'daily') {
    // Reset at 00:00 UTC tomorrow
    resetDate.setUTCHours(24, 0, 0, 0);
  } else if (type === 'weekly') {
    // Reset next Monday at 00:00 UTC
    const dayOfWeek = now.getUTCDay();
    const daysUntilMonday = (8 - dayOfWeek) % 7 || 7;
    resetDate.setUTCDate(now.getUTCDate() + daysUntilMonday);
    resetDate.setUTCHours(0, 0, 0, 0);
  } else if (type === 'monthly') {
    // Reset on 1st of next month at 00:00 UTC
    resetDate.setUTCMonth(now.getUTCMonth() + 1, 1);
    resetDate.setUTCHours(0, 0, 0, 0);
  }
  
  return admin.firestore.Timestamp.fromDate(resetDate);
}

// Generate new quests of a given type
export async function generateQuests(type) {
  console.log(`📜 Generating new ${type} quests...`);
  
  let questList, completionBonus, count;
  
  // Define how many quests to generate
  if (type === 'daily') {
    count = 10;
  } else if (type === 'weekly') {
    count = 7;
  } else if (type === 'monthly') {
    count = 7;
  }
  
  // Generate dynamic quests with level scaling
  questList = generateDynamicQuests(type, count);
  completionBonus = generateCompletionBonus(type);
  
  const resetTime = getNextResetTime(type);
  
  const questDoc = {
    id: type,
    type,
    resetTime,
    activeUntil: resetTime,
    quests: questList,
    completionBonus,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  // Save to Firestore
  try {
    await db.collection('quests').doc(type).set(questDoc);
  } catch (error) {
    if (error.code === 8 || error.message?.includes('Quota exceeded') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn(`[Quest Service] Firestore quota exceeded while saving ${type} quests, but quests are generated`);
      // Continue anyway - we'll cache the generated quests
    } else {
      throw error;
    }
  }
  
  // Update cache with newly generated quests
  questCache[type] = {
    data: questDoc,
    expiresAt: Date.now() + CACHE_TTL_MS
  };
  
  console.log(`✅ Generated ${questList.length} ${type} quests (level-scaled, procedurally generated)`);
  
  return questDoc;
}

// Check if quests need to be reset
export async function checkAndResetQuests() {
  const now = admin.firestore.Timestamp.now();
  
  for (const type of ['daily', 'weekly', 'monthly']) {
    try {
      const questDoc = await db.collection('quests').doc(type).get();
      
      if (!questDoc.exists) {
        // No quests exist yet, generate them
        console.log(`📜 No ${type} quests found, generating...`);
        await generateQuests(type);
        continue;
      }
      
      const questData = questDoc.data();
      
      // Check if reset time has passed
      if (questData.resetTime.toMillis() <= now.toMillis()) {
        console.log(`🔄 ${type} quests expired, regenerating...`);
        await generateQuests(type);
        
        // Invalidate cache when quests are regenerated
        questCache[type] = { data: null, expiresAt: null };
        
        // Reset all player progress for this quest type
        await resetPlayerQuestProgress(type);
      } else {
        // Update cache with current quests if they're still valid
        questCache[type] = {
          data: questData,
          expiresAt: Date.now() + CACHE_TTL_MS
        };
      }
    } catch (error) {
      if (error.code === 8 || error.message?.includes('Quota exceeded') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[Quest Service] Firestore quota exceeded while checking ${type} quests, skipping reset check`);
        // Continue to next quest type
        continue;
      } else {
        throw error;
      }
    }
  }
}

// Reset player quest progress for a given type
async function resetPlayerQuestProgress(type) {
  console.log(`🔄 Resetting player ${type} quest progress...`);
  
  const heroesSnapshot = await db.collection('heroes').get();
  const batch = db.batch();
  
  heroesSnapshot.forEach(doc => {
    const updateData = {};
    updateData[`questProgress.${type}`] = {};
    updateData[`questProgress.last${capitalize(type)}Reset`] = admin.firestore.FieldValue.serverTimestamp();
    
    if (type === 'daily') {
      updateData['questProgress.dailyBonusClaimed'] = false;
    } else if (type === 'weekly') {
      updateData['questProgress.weeklyBonusClaimed'] = false;
      updateData['questProgress.dailiesCompletedThisWeek'] = 0;
    } else if (type === 'monthly') {
      updateData['questProgress.monthlyBonusClaimed'] = false;
      updateData['questProgress.dailiesCompletedThisMonth'] = 0;
      updateData['questProgress.weekliesCompletedThisMonth'] = 0;
    }
    
    batch.update(doc.ref, updateData);
  });
  
  await batch.commit();
  console.log(`✅ Reset ${heroesSnapshot.size} players' ${type} progress`);
}

// Helper to capitalize first letter
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Initialize quest system (call on server start)
export async function initializeQuestSystem() {
  console.log('📜 Initializing quest system...');
  
  await checkAndResetQuests();
  
  // Check every hour for quest resets
  setInterval(async () => {
    await checkAndResetQuests();
  }, 60 * 60 * 1000); // 1 hour
  
  console.log('✅ Quest system initialized');
}

// Get active quests of a given type (with caching and quota error handling)
export async function getActiveQuests(type) {
  // Check cache first
  const cached = questCache[type];
  if (cached && cached.data && cached.expiresAt && Date.now() < cached.expiresAt) {
    console.log(`[Quest Cache] Returning cached ${type} quests`);
    return cached.data;
  }
  
  try {
    const questDoc = await db.collection('quests').doc(type).get();
    
    if (!questDoc.exists) {
      // Generate if doesn't exist
      const generated = await generateQuests(type);
      // Cache the generated quests
      questCache[type] = {
        data: generated,
        expiresAt: Date.now() + CACHE_TTL_MS
      };
      return generated;
    }
    
    const questData = questDoc.data();
    
    // Update cache
    questCache[type] = {
      data: questData,
      expiresAt: Date.now() + CACHE_TTL_MS
    };
    
    return questData;
  } catch (error) {
    // Handle quota errors - return cached data if available
    if (error.code === 8 || error.message?.includes('Quota exceeded') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn(`[Quest Service] Firestore quota exceeded for ${type} quests, attempting to return cached data`);
      
      if (cached && cached.data) {
        console.log(`[Quest Cache] Returning stale cached ${type} quests due to quota error`);
        return cached.data;
      }
      
      // If no cache, throw the error
      console.error(`[Quest Service] No cached data available for ${type} quests`);
      throw new Error(`Firestore quota exceeded and no cached data available. Please try again later.`);
    }
    
    // Re-throw other errors
    throw error;
  }
}
