// Flexible matchmaking for 2-5 player dungeons
// Supports party queue and fill queue

import admin from 'firebase-admin';
import { db } from '../index.js';

// Role normalization: Map hero roles to tank/healer/dps categories
function normalizeRole(heroRole) {
  if (!heroRole) return 'dps';
  
  const roleLower = heroRole.toLowerCase();
  
  // Tank roles
  const tankRoles = ['guardian', 'paladin', 'warden', 'bloodknight', 'vanguard', 'brewmaster'];
  if (tankRoles.includes(roleLower) || roleLower === 'tank') {
    return 'tank';
  }
  
  // Healer roles
  const healerRoles = ['cleric', 'atoner', 'druid', 'lightbringer', 'shaman', 'mistweaver', 'chronomancer', 'bard'];
  if (healerRoles.includes(roleLower) || roleLower === 'healer') {
    return 'healer';
  }
  
  // Everything else is DPS
  return 'dps';
}

/**
 * Flexible matchmaking for 2-5 player dungeons
 * Priority:
 * 1. Complete parties (2-5 members) that meet dungeon requirements
 * 2. Incomplete parties + individuals to reach 2-5 players
 * 3. Individual players to form groups of 2-5 players
 */
/**
 * Get available dungeons for a group of players
 * Checks level and item score requirements for all members
 */
async function getAvailableDungeonsForGroup(members) {
  const { getAllDungeons, getDungeonById } = await import('../data/dungeons.js');
  const allDungeons = getAllDungeons();
  
  // Get hero data for all members
  const heroPromises = members.map(member => 
    db.collection('heroes').doc(member.heroId).get()
  );
  const heroDocs = await Promise.all(heroPromises);
  
  const heroes = [];
  for (let i = 0; i < heroDocs.length; i++) {
    if (heroDocs[i].exists) {
      heroes.push(heroDocs[i].data());
    }
  }
  
  if (heroes.length === 0) {
    return [];
  }
  
  // Calculate average level and item score
  let totalLevel = 0;
  let totalItemScore = 0;
  
  for (const hero of heroes) {
    const heroLevel = hero.level || 1;
    totalLevel += heroLevel;
    
    // Calculate item score
    let itemScore = 0;
    if (hero.equipment) {
      Object.values(hero.equipment).forEach(item => {
        if (item) {
          const baseScore = (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
          const rarityBonus = item.rarity === 'legendary' ? 1.5 : 
                              item.rarity === 'epic' ? 1.3 : 
                              item.rarity === 'rare' ? 1.1 : 1.0;
          const procBonus = (item.procEffects?.length || 0) * 50;
          itemScore += Math.floor((baseScore * rarityBonus) + procBonus);
        }
      });
    }
    totalItemScore += itemScore;
  }
  
  const avgLevel = totalLevel / heroes.length;
  const avgItemScore = totalItemScore / heroes.length;
  
  // Filter dungeons that all members can access
  const availableDungeons = allDungeons.filter(dungeon => {
    // Check level requirement
    if (dungeon.minLevel && avgLevel < dungeon.minLevel) {
      return false;
    }
    
    // Check item score requirement
    if (dungeon.minItemScore && avgItemScore < dungeon.minItemScore) {
      return false;
    }
    
    // For launch, only return goblin_cave (can be expanded later)
    if (dungeon.id === 'goblin_cave') {
      return true;
    }
    
    return false; // Hide other dungeons for launch
  });
  
  return availableDungeons;
}

export async function tryMatchmaking() {
  try {
    const { getAllDungeons, getDungeonById } = await import('../data/dungeons.js');
    
    // Get queue entries
    const queueSnapshot = await db.collection('dungeonQueue').get();
    const queue = queueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (queue.length === 0) {
      return 0;
    }
    
    // Check if queue entries have a specific dungeonId
    const dungeonIds = new Set(queue.map(q => q.dungeonId).filter(Boolean));
    
    let availableDungeons = [];
    
    if (dungeonIds.size > 0) {
      // Use specific dungeon from queue entries
      for (const dungeonId of dungeonIds) {
        const dungeon = getDungeonById(dungeonId);
        if (dungeon) {
          availableDungeons.push(dungeon);
        }
      }
    } else {
      // No specific dungeon - get available dungeons for the group
      availableDungeons = await getAvailableDungeonsForGroup(queue);
    }
    
    if (availableDungeons.length === 0) {
      console.log('[Matchmaking] No available dungeons for queue');
      return 0;
    }
    
    // Use the first available dungeon (or prioritize goblin_cave for launch)
    const launchDungeon = availableDungeons.find(d => d.id === 'goblin_cave') || availableDungeons[0];
    
    if (!launchDungeon) {
      console.log('[Matchmaking] No valid dungeon found');
      return 0;
    }
    
    const minPlayers = launchDungeon.minPlayers || 2;
    const maxPlayers = launchDungeon.maxPlayers || 5;
    
    let groupsFormed = 0;
    
    // PRIORITY 1: Match complete parties (2-5 members)
    const partyGroups = new Map(); // partyId -> array of queue entries
    queue.forEach(entry => {
      if (entry.partyId) {
        if (!partyGroups.has(entry.partyId)) {
          partyGroups.set(entry.partyId, []);
        }
        partyGroups.get(entry.partyId).push(entry);
      }
    });
    
    for (const [partyId, partyMembers] of partyGroups.entries()) {
      // Check if party wants to fill (default true)
      const wantsToFill = partyMembers[0]?.fillParty !== false;
      
      // If party wants to fill and doesn't have maxPlayers, skip them (they'll be handled in PRIORITY 2)
      if (wantsToFill && partyMembers.length < maxPlayers) {
        console.log(`[Matchmaking] Party ${partyId} (${partyMembers.length} members) wants to fill, skipping immediate match`);
        continue;
      }
      
      if (partyMembers.length >= minPlayers && partyMembers.length <= maxPlayers) {
        // Party meets requirements - match them
        // Check if party has a specific dungeon preference
        const partyDungeonId = partyMembers[0]?.dungeonId;
        const dungeonToUse = partyDungeonId ? getDungeonById(partyDungeonId) : launchDungeon;
        
        if (!dungeonToUse) {
          console.warn(`[Matchmaking] Party ${partyId} requested dungeon ${partyDungeonId} but it's not available`);
          continue;
        }
        
        // Validate party size against dungeon requirements
        if (partyMembers.length < dungeonToUse.minPlayers || partyMembers.length > dungeonToUse.maxPlayers) {
          console.warn(`[Matchmaking] Party ${partyId} size ${partyMembers.length} doesn't match dungeon ${dungeonToUse.id} requirements (${dungeonToUse.minPlayers}-${dungeonToUse.maxPlayers})`);
          continue;
        }
        
        try {
          await createDungeonInstanceForGroup({
            members: partyMembers,
            partyId
          }, dungeonToUse);
          
          // Remove from queue
          const idsToRemove = partyMembers.map(m => m.id);
          const deletePromises = idsToRemove.map(id => db.collection('dungeonQueue').doc(id).delete());
          await Promise.all(deletePromises);
          
          // Update party status
          try {
            const partyRef = db.collection('parties').doc(partyId);
            await partyRef.update({
              status: 'in_instance',
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          } catch (error) {
            console.error(`[Matchmaking] Failed to update party ${partyId} status:`, error);
          }
          
          console.log(`[Matchmaking] ✅ Party ${partyId} matched: ${partyMembers.length} members`);
          groupsFormed++;
        } catch (error) {
          console.error(`[Matchmaking] ❌ Failed to create dungeon instance for party ${partyId}:`, error);
        }
      }
    }
    
    // PRIORITY 2: Match incomplete parties with individuals
    const updatedQueueSnapshot = await db.collection('dungeonQueue').get();
    const updatedQueue = updatedQueueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const incompleteParties = new Map();
    updatedQueue.forEach(entry => {
      if (entry.partyId) {
        if (!incompleteParties.has(entry.partyId)) {
          incompleteParties.set(entry.partyId, []);
        }
        incompleteParties.get(entry.partyId).push(entry);
      }
    });
    
    for (const [partyId, partyMembers] of incompleteParties.entries()) {
      // Check if party wants to fill (default true)
      const wantsToFill = partyMembers[0]?.fillParty !== false;
      
      if (partyMembers.length < minPlayers) {
        // Party needs more members to meet minimum
        const needed = minPlayers - partyMembers.length;
        const individualQueue = updatedQueue.filter(q => !q.partyId);
        
        if (individualQueue.length >= needed && (partyMembers.length + needed) <= maxPlayers) {
          // Add individuals to complete the party
          const additionalMembers = individualQueue.slice(0, needed);
          const allMembers = [...partyMembers, ...additionalMembers];
          
          // Check if party has a specific dungeon preference
          const partyDungeonId = partyMembers[0]?.dungeonId;
          const dungeonToUse = partyDungeonId ? getDungeonById(partyDungeonId) : launchDungeon;
          
          if (!dungeonToUse) {
            console.warn(`[Matchmaking] Incomplete party ${partyId} requested dungeon ${partyDungeonId} but it's not available`);
            continue;
          }
          
          // Validate group size against dungeon requirements
          if (allMembers.length < dungeonToUse.minPlayers || allMembers.length > dungeonToUse.maxPlayers) {
            console.warn(`[Matchmaking] Incomplete party ${partyId} size ${allMembers.length} doesn't match dungeon ${dungeonToUse.id} requirements (${dungeonToUse.minPlayers}-${dungeonToUse.maxPlayers})`);
            continue;
          }
          
          try {
            await createDungeonInstanceForGroup({
              members: allMembers,
              partyId
            }, dungeonToUse);
            
            // Remove all from queue
            const idsToRemove = allMembers.map(m => m.id);
            const deletePromises = idsToRemove.map(id => db.collection('dungeonQueue').doc(id).delete());
            await Promise.all(deletePromises);
            
            // Update party status
            try {
              const partyRef = db.collection('parties').doc(partyId);
              await partyRef.update({
                status: 'in_instance',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } catch (error) {
              console.error(`[Matchmaking] Failed to update party ${partyId} status:`, error);
            }
            
            console.log(`[Matchmaking] ✅ Incomplete party ${partyId} (${partyMembers.length} members) matched with ${needed} individual(s): ${allMembers.length} total`);
            groupsFormed++;
          } catch (error) {
            console.error(`[Matchmaking] ❌ Failed to create dungeon instance for incomplete party ${partyId}:`, error);
          }
        }
      } else if (wantsToFill && partyMembers.length >= minPlayers && partyMembers.length < maxPlayers) {
        // Party meets minimum but wants to fill to maxPlayers
        const needed = maxPlayers - partyMembers.length;
        const individualQueue = updatedQueue.filter(q => !q.partyId);
        
        if (individualQueue.length >= needed) {
          // Add individuals to fill party to maxPlayers
          const additionalMembers = individualQueue.slice(0, needed);
          const allMembers = [...partyMembers, ...additionalMembers];
          
          // Check if party has a specific dungeon preference
          const partyDungeonId = partyMembers[0]?.dungeonId;
          const dungeonToUse = partyDungeonId ? getDungeonById(partyDungeonId) : launchDungeon;
          
          if (!dungeonToUse) {
            console.warn(`[Matchmaking] Incomplete party ${partyId} requested dungeon ${partyDungeonId} but it's not available`);
            continue;
          }
          
          // Validate group size against dungeon requirements
          if (allMembers.length < dungeonToUse.minPlayers || allMembers.length > dungeonToUse.maxPlayers) {
            console.warn(`[Matchmaking] Incomplete party ${partyId} size ${allMembers.length} doesn't match dungeon ${dungeonToUse.id} requirements (${dungeonToUse.minPlayers}-${dungeonToUse.maxPlayers})`);
            continue;
          }
          
          try {
            await createDungeonInstanceForGroup({
              members: allMembers,
              partyId
            }, dungeonToUse);
            
            // Remove all from queue
            const idsToRemove = allMembers.map(m => m.id);
            const deletePromises = idsToRemove.map(id => db.collection('dungeonQueue').doc(id).delete());
            await Promise.all(deletePromises);
            
            // Update party status
            try {
              const partyRef = db.collection('parties').doc(partyId);
              await partyRef.update({
                status: 'in_instance',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            } catch (error) {
              console.error(`[Matchmaking] Failed to update party ${partyId} status:`, error);
            }
            
            console.log(`[Matchmaking] ✅ Party ${partyId} (${partyMembers.length} members) filled to ${allMembers.length} with ${needed} individual(s)`);
            groupsFormed++;
          } catch (error) {
            console.error(`[Matchmaking] ❌ Failed to create dungeon instance for filling party ${partyId}:`, error);
          }
        }
      }
    }
    
    // PRIORITY 3: Match individual players (no party)
    const finalQueueSnapshot = await db.collection('dungeonQueue').get();
    const finalQueue = finalQueueSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const individualQueue = finalQueue.filter(q => !q.partyId);
    
    // Try to form groups of 2-5 players
    // Prefer groups with at least 1 tank or healer, but allow all DPS if needed
    while (individualQueue.length >= minPlayers) {
      // Take up to maxPlayers from the queue
      const groupSize = Math.min(maxPlayers, individualQueue.length);
      const groupMembers = individualQueue.splice(0, groupSize);
      
      // Check if group has a specific dungeon preference (use first member's preference)
      const groupDungeonId = groupMembers[0]?.dungeonId;
      const dungeonToUse = groupDungeonId ? getDungeonById(groupDungeonId) : launchDungeon;
      
      if (!dungeonToUse) {
        console.warn(`[Matchmaking] Individual group requested dungeon ${groupDungeonId} but it's not available`);
        continue;
      }
      
      // Validate group size against dungeon requirements
      if (groupMembers.length < dungeonToUse.minPlayers || groupMembers.length > dungeonToUse.maxPlayers) {
        console.warn(`[Matchmaking] Individual group size ${groupMembers.length} doesn't match dungeon ${dungeonToUse.id} requirements (${dungeonToUse.minPlayers}-${dungeonToUse.maxPlayers})`);
        continue;
      }
      
      try {
        await createDungeonInstanceForGroup({
          members: groupMembers,
          partyId: null
        }, dungeonToUse);
        
        // Remove from queue
        const idsToRemove = groupMembers.map(m => m.id);
        const deletePromises = idsToRemove.map(id => db.collection('dungeonQueue').doc(id).delete());
        await Promise.all(deletePromises);
        
        console.log(`[Matchmaking] ✅ Individual group formed: ${groupMembers.length} players`);
        groupsFormed++;
      } catch (error) {
        console.error(`[Matchmaking] ❌ Failed to create dungeon instance for individual group:`, error);
        // Put members back in queue if creation failed
        individualQueue.unshift(...groupMembers);
        break; // Stop trying if we hit an error
      }
    }
    
    if (groupsFormed === 0 && queue.length > 0) {
      console.log(`[Matchmaking] ⏳ Waiting for more players: ${queue.length} in queue, need at least ${minPlayers} to form a group`);
    }
    
    return groupsFormed;
  } catch (error) {
    console.error('[Matchmaking] Error in matchmaking:', error);
    return 0;
  }
}

/**
 * Create dungeon instance for a group (party or individuals)
 */
export async function createDungeonInstanceForGroup(group, dungeonData) {
  try {
    const { members, partyId } = group;
    
    if (!members || members.length === 0) {
      throw new Error('Group has no members');
    }
    
    // Validate group size
    if (members.length < dungeonData.minPlayers || members.length > dungeonData.maxPlayers) {
      throw new Error(`Group size ${members.length} doesn't meet dungeon requirements (${dungeonData.minPlayers}-${dungeonData.maxPlayers})`);
    }
    
    // Load participant hero data
    const participantData = [];
    for (const member of members) {
      const heroDoc = await db.collection('heroes').doc(member.heroId).get();
      if (!heroDoc.exists) {
        console.warn(`[Matchmaking] Hero not found: ${member.heroId}, skipping...`);
        continue;
      }
      const hero = heroDoc.data();
      const twitchUserId = hero.twitchUserId || member.heroId;
      
      participantData.push({
        userId: member.heroId,
        heroId: member.heroId,
        twitchUserId: twitchUserId,
        username: hero.name || member.heroId,
        heroName: hero.name,
        heroRole: hero.role,
        heroLevel: hero.level || 1,
        currentHp: hero.hp || hero.maxHp || 100,
        maxHp: hero.maxHp || 100,
        isAlive: true,
        deaths: 0
      });
    }
    
    if (participantData.length < dungeonData.minPlayers) {
      throw new Error(`Not enough valid heroes: ${participantData.length} < ${dungeonData.minPlayers}`);
    }
    
    // Extract participant IDs for querying
    const participantIds = participantData.map(p => p.twitchUserId).filter(Boolean);
    
    // Use first member as organizer
    const organizerId = members[0].userId;
    
    // Create dungeon instance
    const dungeonInstance = {
      dungeonId: dungeonData.id,
      difficulty: dungeonData.difficulty || 'normal',
      status: 'active',
      organizerId,
      participants: participantData,
      participantIds: participantIds,
      currentRoom: 0,
      maxRooms: dungeonData.rooms.length,
      rooms: dungeonData.rooms,
      combatLog: [],
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now()
    };
    
    const instanceRef = await db.collection('dungeonInstances').add(dungeonInstance);
    
    console.log(`[Matchmaking] 🏰 Created dungeon instance ${instanceRef.id} for group: ${dungeonData.name} (${participantData.length} players)`);
    
    // Update all heroes to have activeInstance pointing to this dungeon
    const participantHeroIds = participantData.map(p => p.heroId);
    const updatePromises = participantHeroIds.map(async (heroId) => {
      try {
        await db.collection('heroes').doc(heroId).update({
          activeInstance: {
            type: 'dungeon',
            instanceId: instanceRef.id
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } catch (error) {
        console.error(`[Matchmaking] Failed to update hero ${heroId} with active instance:`, error);
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`[Matchmaking] ✅ Updated all ${participantData.length} heroes with active dungeon instance`);
    
    return instanceRef.id;
  } catch (error) {
    console.error('[Matchmaking] Error creating dungeon instance:', error);
    throw error;
  }
}
