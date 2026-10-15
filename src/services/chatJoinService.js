/**
 * Chat Join Service
 * Shared logic for handling viewer !join commands
 * Used by both HTTP route and Twitch bot internal calls
 */

import admin from 'firebase-admin';
import { ROLE_CONFIG } from '../data/roleConfig.js';

// Get db lazily to avoid circular dependency
const getDb = () => {
  return admin.firestore();
};

/**
 * Handle viewer join command
 * @param {Object} params - Join parameters
 * @param {string} params.viewerUsername - Viewer's Twitch username
 * @param {string} params.viewerId - Viewer's Twitch user ID
 * @param {string} params.streamerUsername - Streamer's channel name
 * @param {string} params.streamerId - Streamer's Twitch user ID
 * @param {string} [params.class] - Optional class name
 * @param {number} [params.heroIndex] - Optional hero index
 * @returns {Promise<Object>} Result with success/error
 */
export async function handleJoinCommand({ viewerUsername, viewerId, streamerUsername, streamerId, class: classKey, heroIndex }) {
  const db = getDb();
  
  if (!viewerUsername || !viewerId) {
    return { success: false, error: 'Viewer username and ID required' };
  }

  if (!streamerUsername) {
    return { success: false, error: 'Streamer username required' };
  }

  // Normalize streamer username to lowercase
  const normalizedStreamerUsername = streamerUsername.toLowerCase().trim();
  
  // Determine battlefield ID - use Twitch ID for consistency and reliability
  const battlefieldId = streamerId ? `twitch:${streamerId}` : `twitch:${normalizedStreamerUsername}`;
  
  console.log(`[Join] Battlefield ID: ${battlefieldId} (streamerId: ${streamerId}, username: ${normalizedStreamerUsername})`);

  // Check if hero already exists for this viewer
  const existingHeroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', viewerId)
    .get();

  let hero = null;
  
  // If heroIndex is provided, select hero by index
  if (heroIndex !== undefined && heroIndex !== null) {
    if (!existingHeroesSnapshot.empty) {
      // Get all heroes ordered by lastActiveAt desc (same order as !heroes)
      const heroes = existingHeroesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      heroes.sort((a, b) => {
        const aTime = a.lastActiveAt?.toMillis?.() ?? new Date(a.lastActiveAt ?? 0).getTime();
        const bTime = b.lastActiveAt?.toMillis?.() ?? new Date(b.lastActiveAt ?? 0).getTime();
        return bTime - aTime;
      });
      
      // Convert 1-based index to 0-based
      const index = parseInt(heroIndex, 10) - 1;
      
      if (isNaN(index) || index < 0 || index >= heroes.length) {
        return { 
          success: false,
          error: `@${viewerUsername} Invalid hero number. Use !heroes to see your characters.` 
        };
      }
      
      hero = heroes[index];
    } else {
      return { 
        success: false,
        error: `@${viewerUsername} No characters found. Use !join [class] to create one!` 
      };
    }
  } else if (!existingHeroesSnapshot.empty) {
    // Use the most recently active hero (by lastActiveAt, fallback to updatedAt)
    const heroes = existingHeroesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    heroes.sort((a, b) => {
      const aTime = a.lastActiveAt?.toMillis?.() ?? 
                   a.updatedAt?.toMillis?.() ?? 
                   new Date(a.lastActiveAt ?? a.updatedAt ?? 0).getTime();
      const bTime = b.lastActiveAt?.toMillis?.() ?? 
                   b.updatedAt?.toMillis?.() ?? 
                   new Date(b.lastActiveAt ?? b.updatedAt ?? 0).getTime();
      return bTime - aTime;
    });
    hero = heroes[0];
  }

  // Handle existing hero (rest of logic from routes/chat.js)
  if (hero) {
    // Removal logic, battlefield assignment, etc. would go here
    // For now, return success with hero info
    const heroName = hero.name || hero.characterName || viewerUsername;
    
    // Update battlefield assignment
    const heroRef = db.collection('heroes').doc(hero.id);
    await heroRef.update({
      currentBattlefieldId: battlefieldId,
      currentBattlefieldType: 'stream',
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return {
      success: true,
      message: `✅ ${heroName} (Level ${hero.level || 1} ${hero.role || 'Berserker'}) joined the battlefield!`,
      hero: { id: hero.id, name: heroName, level: hero.level, role: hero.role }
    };
  }

  // Create new hero (logic from routes/chat.js)
  const selectedRole = classKey && ROLE_CONFIG[classKey.toLowerCase()] ? classKey.toLowerCase() : 'berserker';
  const roleData = ROLE_CONFIG[selectedRole];
  
  const newHero = {
    twitchUserId: viewerId,
    twitchUsername: viewerUsername.toLowerCase(),
    name: `${viewerUsername}'s ${roleData.name}`,
    characterName: `${viewerUsername}'s ${roleData.name}`,
    role: selectedRole,
    level: 1,
    xp: 0,
    health: roleData.baseHealth,
    maxHealth: roleData.baseHealth,
    attack: roleData.baseAttack,
    defense: roleData.baseDefense,
    gold: 100,
    tokens: 0,
    currentBattlefieldId: battlefieldId,
    currentBattlefieldType: 'stream',
    equipment: {
      weapon: null,
      armor: null,
      accessory: null,
      shield: null
    },
    inventory: [],
    skills: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const heroRef = await db.collection('heroes').add(newHero);
  const heroId = heroRef.id;

  return {
    success: true,
    message: `🎉 Welcome, ${viewerUsername}! Created a new Level 1 ${roleData.name}. Use !stats to see your character.`,
    hero: { id: heroId, name: newHero.name, level: 1, role: selectedRole }
  };
}
