/**
 * Command Handler Service
 * Processes game commands from Twitch chat and updates Firebase
 */

import { db } from '../index.js';
import { ROLE_CONFIG } from '../data/roleConfig.js';
import admin from 'firebase-admin';
import { getHeroCache, getHeroByTwitchIdCache } from '../utils/heroCache.js';

/**
 * Get all heroes in a battlefield
 */
async function getBattlefieldHeroes(battlefieldId) {
  const snapshot = await db.collection('heroes')
    .where('currentBattlefieldId', '==', battlefieldId)
    .get();
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Check if command is on cooldown
 */
function isOnCooldown(hero, commandName, cooldownSeconds) {
  if (!hero.cooldowns) return false;
  const lastUsed = hero.cooldowns[commandName];
  if (!lastUsed) return false;
  
  const cooldownMs = cooldownSeconds * 1000;
  const timeSince = Date.now() - lastUsed;
  return timeSince < cooldownMs;
}

/**
 * Get remaining cooldown time in seconds
 */
function getCooldownRemaining(hero, commandName, cooldownSeconds) {
  if (!hero.cooldowns || !hero.cooldowns[commandName]) return 0;
  const cooldownMs = cooldownSeconds * 1000;
  const timeSince = Date.now() - hero.cooldowns[commandName];
  const remaining = Math.ceil((cooldownMs - timeSince) / 1000);
  return Math.max(0, remaining);
}

/**
 * Update command cooldown
 */
async function updateCooldown(heroId, commandName) {
  const cooldowns = {};
  cooldowns[`cooldowns.${commandName}`] = Date.now();
  await db.collection('heroes').doc(heroId).update(cooldowns);
}

/**
 * Check if viewer is the streamer (battlefield owner) or an authorized admin
 * @param {string} viewerUsername - The viewer's username
 * @param {string} viewerId - The viewer's Twitch user ID
 * @param {string} streamerUsername - The streamer's username
 * @returns {Promise<boolean>}
 */
async function isAuthorizedAdmin(viewerUsername, viewerId, streamerUsername) {
  // Check if viewer is the streamer
  if (viewerUsername.toLowerCase() === streamerUsername.toLowerCase()) {
    return true;
  }
  
  // TODO: Check if viewer is in streamer's mod list (future feature)
  // For now, only streamer is authorized
  return false;
}

/**
 * Process a game command
 * @param {string} command - The command name (e.g., 'attack', 'stats')
 * @param {string[]} args - Command arguments
 * @param {string} viewerUsername - The viewer who sent the command
 * @param {string} viewerId - The viewer's Twitch user ID
 * @param {string} streamerUsername - The streamer's channel
 * @returns {Promise<{success: boolean, message: string, data?: any}>}
 */
export async function processCommand(command, args, viewerUsername, viewerId, streamerUsername, streamerId = null) {
  try {
    // Use numeric streamerId if available (for queues), otherwise use username (legacy)
    const battlefieldId = streamerId ? `twitch:${streamerId}` : `twitch:${streamerUsername.toLowerCase()}`;
    const commandLower = command.toLowerCase();
    
    console.log(`[Command] Processing !${command} - BattlefieldId: ${battlefieldId}, StreamerId: ${streamerId}`);
    
    // Commands that don't require hero to be in battlefield
    switch (commandLower) {
      case 'join':
        // Join is handled separately in twitch-events.js
        return {
          success: false,
          message: `@${viewerUsername} Use !join [class] to join the battlefield.`
        };
      
      case 'classes':
        return await handleClassesCommand(viewerUsername);
      
      case 'help':
      case 'commands':
        return await handleHelpCommand(viewerUsername);
      
      case 'heroes':
        return await handleHeroesCommand(viewerUsername, viewerId);
      
      case 'level':
      case 'grantlegendary':
      case 'grantlegendaries':
      case 'push':
      case 'pushfirebase':
      case 'sync':
      case 'syncfirebase':
        // Admin commands - check authorization first
        const isAdmin = await isAuthorizedAdmin(viewerUsername, viewerId, streamerUsername);
        if (!isAdmin) {
          return {
            success: false,
            message: `@${viewerUsername} Admin commands are only available to the streamer.`
          };
        }
        // Fall through to get hero if needed
        break;
      
      default:
        // Commands that require hero - will be handled below
        break;
    }
    
    // Get hero for commands that need it (with caching)
    const heroCache = getHeroCache();
    const twitchIdCache = getHeroByTwitchIdCache();
    let hero = null;
    
    // Try cache first
    let cachedHeroId = twitchIdCache.get(viewerId);
    if (cachedHeroId) {
      hero = heroCache.get(cachedHeroId);
      if (hero && hero.currentBattlefieldId === battlefieldId) {
        // Cache hit and hero is in correct battlefield
      } else {
        hero = null; // Cache miss or wrong battlefield
      }
    }
    
    if (!hero) {
      // Cache miss - query Firestore
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', viewerId)
        .where('currentBattlefieldId', '==', battlefieldId)
        .limit(1)
        .get();

      if (!heroesSnapshot.empty) {
        const heroDoc = heroesSnapshot.docs[0];
        hero = { id: heroDoc.id, ...heroDoc.data() };
        
        // Cache the hero
        heroCache.set(hero.id, hero);
        twitchIdCache.set(viewerId, hero.id);
        
        // Initialize equipment slots if missing
        const { initializeEquipmentSlots } = await import('./gearService.js');
        const initializedEquipment = initializeEquipmentSlots(hero);
        if (initializedEquipment) {
          const currentSlots = Object.keys(hero.equipment || {});
          const expectedSlots = Object.keys(initializedEquipment);
          const needsUpdate = expectedSlots.some(slot => !(slot in (hero.equipment || {})));
          
          if (needsUpdate) {
            const heroRef = db.collection('heroes').doc(hero.id);
            await heroRef.update({ equipment: initializedEquipment });
            hero.equipment = initializedEquipment;
            
            // Invalidate cache after update
            heroCache.invalidate(hero.id);
            
            console.log(`✅ [Command] Initialized equipment slots for hero ${hero.id}`);
          }
        }
      } else {
        // No hero found - clear cache entry if it exists
        if (cachedHeroId) {
          twitchIdCache.invalidate(viewerId);
        }
      }
      
      // Initialize equipment slots if missing (similar to quest progress)
      const { initializeEquipmentSlots } = await import('./gearService.js');
      const initializedEquipment = initializeEquipmentSlots(hero);
      if (initializedEquipment) {
        const currentSlots = Object.keys(hero.equipment || {});
        const expectedSlots = Object.keys(initializedEquipment);
        const needsUpdate = expectedSlots.some(slot => !(slot in (hero.equipment || {})));
        
        if (needsUpdate) {
          await heroDoc.ref.update({ equipment: initializedEquipment });
          hero.equipment = initializedEquipment;
          console.log(`✅ [Command] Initialized equipment slots for hero ${hero.id}`);
        }
      }
    }

    // Command aliases (convert shortcuts to full commands)
    const aliases = {
      'a': 'attack',
      'h': 'heal',
      's': 'stats',
      'g': 'gear'
    };
    if (aliases[commandLower]) {
      commandLower = aliases[commandLower];
    }

    // Route to appropriate command handler
    switch (commandLower) {
      case 'stats':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleStatsCommand(hero, viewerUsername);
      
      case 'gear':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleGearCommand(hero, viewerUsername);
      
      case 'shop':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleShopCommand(hero, viewerUsername);
      
      case 'attack':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleAttackCommand(hero, args, viewerUsername, battlefieldId);
      
      case 'heal':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleHealCommand(hero, args, viewerUsername, battlefieldId);
      
      case 'cast':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleCastCommand(hero, args, viewerUsername, battlefieldId);
      
      case 'defend':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleDefendCommand(hero, viewerUsername, battlefieldId);
      
      case 'buy':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleBuyCommand(hero, args, viewerUsername);
      
      case 'use':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleUseCommand(hero, args, viewerUsername);
      
      case 'rest':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleRestCommand(hero, viewerUsername, battlefieldId);
      
      case 'claim':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleClaimCommand(hero, viewerUsername);
      
      case 'tokens':
        if (!hero) return { success: false, message: `@${viewerUsername} Join the battle with !join to use this command.` };
        return await handleTokensCommand(hero, viewerUsername);
      
      case 'leave':
        // Leave command supports optional hero index: !leave [index]
        // If index provided, leave that specific hero
        // If no index, leave ALL heroes from this battlefield
        const leaveIndex = args[0] && !isNaN(parseInt(args[0], 10)) ? parseInt(args[0], 10) : null;
        
        if (leaveIndex !== null) {
          // User specified a hero index - leave that specific hero
          const heroesSnapshot = await db.collection('heroes')
            .where('twitchUserId', '==', viewerId)
            .get();
          
          if (heroesSnapshot.empty) {
            return { success: false, message: `@${viewerUsername} You don't have any characters! Use !join [class] to create one.` };
          }
          
          // Sort by lastActiveAt desc (same order as !heroes)
          const heroes = heroesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          heroes.sort((a, b) => {
            const aTime = a.lastActiveAt?.toMillis?.() ?? new Date(a.lastActiveAt ?? 0).getTime();
            const bTime = b.lastActiveAt?.toMillis?.() ?? new Date(b.lastActiveAt ?? 0).getTime();
            return bTime - aTime;
          });
          
          const index = leaveIndex - 1; // Convert 1-based to 0-based
          if (index < 0 || index >= heroes.length) {
            return { success: false, message: `@${viewerUsername} Invalid character number. Use !heroes to see your characters.` };
          }
          
          const selectedHero = heroes[index];
          return await handleLeaveCommand(selectedHero, viewerUsername, battlefieldId);
        } else {
          // No index provided - leave ALL heroes from this battlefield
          const heroesInBattlefield = await db.collection('heroes')
            .where('twitchUserId', '==', viewerId)
            .where('currentBattlefieldId', '==', battlefieldId)
            .get();
          
          if (heroesInBattlefield.empty) {
            // Try to find any hero for this user (might be in different battlefield)
            const anyHeroSnapshot = await db.collection('heroes')
              .where('twitchUserId', '==', viewerId)
              .limit(1)
              .get();
            
            if (anyHeroSnapshot.empty) {
              return { success: false, message: `@${viewerUsername} You don't have any characters! Use !join [class] to create one.` };
            }
            
            const heroDoc = anyHeroSnapshot.docs[0];
            hero = { id: heroDoc.id, ...heroDoc.data() };
            return await handleLeaveCommand(hero, viewerUsername, battlefieldId);
          }
          
          // Leave all heroes from this battlefield
          // IMPORTANT: Broadcast for ALL heroes (even deleted ones) so browser source can remove them
          // Use batch read to check all heroes at once for better performance
          const heroRefs = heroesInBattlefield.docs.map(doc => db.collection('heroes').doc(doc.id));
          const heroChecks = await Promise.all(heroRefs.map(ref => ref.get()));
          
          const validHeroes = [];
          const deletedHeroIds = [];
          for (let i = 0; i < heroesInBattlefield.docs.length; i++) {
            const heroDoc = heroesInBattlefield.docs[i];
            const heroCheck = heroChecks[i];
            if (heroCheck.exists) {
              validHeroes.push({ id: heroDoc.id, ...heroDoc.data() });
            } else {
              // Hero was deleted - still need to broadcast so browser source removes it
              deletedHeroIds.push(heroDoc.id);
              console.warn(`⚠️ [Leave] Hero document ${heroDoc.id} was deleted, but will still broadcast removal`);
            }
          }
          
          // Broadcast for deleted heroes first (they need immediate removal from browser source)
          if (deletedHeroIds.length > 0) {
            try {
              const { broadcastToRoom } = await import('../websocket/server.js');
              // Convert battlefield ID to Twitch ID for WebSocket
              let streamerTwitchId = null;
              if (battlefieldId.startsWith('twitch:')) {
                const identifier = battlefieldId.replace('twitch:', '').trim();
                
                // Check if it's a numeric Twitch ID (like "1087777297")
                if (/^\d+$/.test(identifier)) {
                  // It's already a numeric ID, use it directly
                  streamerTwitchId = identifier;
                } else {
                  // It's a username, look up streamer's Twitch ID from their hero document
                  const streamerUsername = identifier.toLowerCase();
                  const streamerHeroSnapshot = await db.collection('heroes')
                    .where('twitchUsername', '==', streamerUsername)
                    .limit(1)
                    .get();
                  if (!streamerHeroSnapshot.empty) {
                    const streamerHero = streamerHeroSnapshot.docs[0].data();
                    streamerTwitchId = streamerHero.twitchUserId || streamerHero.twitchId;
                  }
                }
              } else {
                streamerTwitchId = battlefieldId;
              }
              
              if (streamerTwitchId) {
                // Broadcast for each deleted hero
                for (const deletedHeroId of deletedHeroIds) {
                  broadcastToRoom(String(streamerTwitchId), {
                    type: 'hero_left_battlefield',
                    hero: { id: deletedHeroId }, // Minimal hero data - just the ID
                    message: `Hero has left the battlefield`,
                    timestamp: Date.now()
                  });
                }
                console.log(`📡 [Leave] Broadcasted removal for ${deletedHeroIds.length} deleted hero(es) to Twitch ID: ${streamerTwitchId}`);
              }
            } catch (broadcastError) {
              console.warn('Failed to broadcast removal for deleted heroes:', broadcastError);
            }
          }
          
          // Process valid heroes normally
          const results = [];
          for (const heroData of validHeroes) {
            const result = await handleLeaveCommand(heroData, viewerUsername, battlefieldId);
            results.push(result);
          }
          
          const totalCount = validHeroes.length + deletedHeroIds.length;
          const successCount = results.filter(r => r.success).length;
          
          if (totalCount === 0) {
            return {
              success: true,
              message: `@${viewerUsername} No active characters found in battlefield.`
            };
          } else if (successCount === validHeroes.length && deletedHeroIds.length === 0) {
            return {
              success: true,
              message: `@${viewerUsername} All ${successCount} character${successCount > 1 ? 's' : ''} left the party!`
            };
          } else {
            return {
              success: true,
              message: `@${viewerUsername} ${totalCount} character${totalCount > 1 ? 's' : ''} left the party!`
            };
          }
        }
      
      case 'rejoin':
        // Rejoin can work with or without hero in battlefield
        // If args[0] is a number, it's selecting a character by index from !heroes
        // If args[0] is a class name, it's switching to that class
        // If no args and hero exists, just rejoin with current hero
        if (args[0] && /^\d+$/.test(args[0])) {
          // User specified a character number (from !heroes list)
          return await handleRejoinByIndexCommand(args[0], viewerUsername, viewerId, battlefieldId);
        }
        return await handleRejoinCommand(hero, args, viewerUsername, viewerId, battlefieldId);
      
      case 'switch':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleSwitchCommand(hero, args, viewerUsername, viewerId, battlefieldId);
      
      case 'auto':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleAutoCommand(hero, viewerUsername, battlefieldId);
      
      case 'quest':
      case 'quests':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleQuestCommand(hero, args, viewerUsername, viewerId);
      
      case 'profession':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleProfessionCommand(hero, args, viewerUsername);
      
      case 'gather':
      case 'herbs':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleGatherCommand(hero, viewerUsername, battlefieldId);
      
      case 'recipes':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleRecipesCommand(hero, args, viewerUsername);
      
      case 'craft':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleCraftCommand(hero, args, viewerUsername, battlefieldId);
      
      case 'elixirs':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleElixirsCommand(hero, viewerUsername);
      
      case 'skills':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleSkillsCommand(hero, viewerUsername);
      
      case 'potion':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handlePotionCommand(hero, viewerUsername, viewerId);
      
      case 'dispel':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleDispelCommand(hero, args, viewerUsername, battlefieldId);
      
      case 'leaderboard':
      case 'rank':
        if (!hero) return { success: false, message: `@${viewerUsername} You need to !join first!` };
        return await handleLeaderboardCommand(hero, viewerUsername);
      
      // ==================== QUEUE SYSTEM ====================
      
      case 'dungeons':
        return await handleDungeonsListCommand(viewerUsername);
      
      case 'raids':
        return await handleRaidsListCommand(viewerUsername);
      
      case 'dungeon':
        // Streamer only - create dungeon queue
        const isDungeonAdmin = await isAuthorizedAdmin(viewerUsername, viewerId, streamerUsername);
        if (!isDungeonAdmin) {
          return { success: false, message: `@${viewerUsername} Only the streamer can create dungeon queues!` };
        }
        return await handleDungeonQueueCommand(args, viewerUsername, viewerId, streamerUsername, battlefieldId);
      
      case 'raid':
        // Streamer only - create raid queue
        const isRaidAdmin = await isAuthorizedAdmin(viewerUsername, viewerId, streamerUsername);
        if (!isRaidAdmin) {
          return { success: false, message: `@${viewerUsername} Only the streamer can create raid queues!` };
        }
        return await handleRaidQueueCommand(args, viewerUsername, viewerId, streamerUsername, battlefieldId);
      
      case 'qdungeon':
        if (!hero) return { success: false, message: `@${viewerUsername} You need a hero to join! Use !join [class] to create one.` };
        return await handleQDungeonJoinCommand(args, hero, viewerUsername, viewerId, battlefieldId);
      
      case 'qraid':
        if (!hero) return { success: false, message: `@${viewerUsername} You need a hero to join! Use !join [class] to create one.` };
        return await handleQRaidJoinCommand(args, hero, viewerUsername, viewerId, battlefieldId);
      
      case 'qstatus':
        return await handleQStatusCommand(battlefieldId, viewerUsername);
      
      case 'qstart':
        const isQStartAdmin = await isAuthorizedAdmin(viewerUsername, viewerId, streamerUsername);
        if (!isQStartAdmin) {
          return { success: false, message: `@${viewerUsername} Only the streamer can force start queues!` };
        }
        return await handleQStartCommand(battlefieldId, viewerUsername, streamerUsername);
      
      case 'qcancel':
        const isQCancelAdmin = await isAuthorizedAdmin(viewerUsername, viewerId, streamerUsername);
        if (!isQCancelAdmin) {
          return { success: false, message: `@${viewerUsername} Only the streamer can cancel queues!` };
        }
        return await handleQCancelCommand(battlefieldId, viewerUsername);
      
      case 'qleave':
        return await handleQLeaveCommand(viewerId, viewerUsername);
      
      case 'level':
        return await handleLevelCommand(hero, args, viewerUsername, viewerId, streamerUsername, battlefieldId);
      
      case 'grantlegendary':
      case 'grantlegendaries':
        return await handleGrantLegendaryCommand(viewerUsername, viewerId, streamerUsername, battlefieldId);
      
      case 'push':
      case 'pushfirebase':
        return await handlePushCommand(viewerUsername, viewerId, streamerUsername, battlefieldId);
      
      case 'sync':
      case 'syncfirebase':
        return await handleSyncCommand(viewerUsername, viewerId, streamerUsername, battlefieldId);
      
      default:
        return {
          success: false,
          message: `@${viewerUsername} Unknown command: !${command}. Use !help for available commands.`
        };
    }
  } catch (error) {
    console.error(`Error processing command !${command} for ${viewerUsername}:`, error);
    return {
      success: false,
      message: `@${viewerUsername} Error processing command. Try again.`
    };
  }
}

/**
 * Handle !stats command
 */
async function handleStatsCommand(hero, username) {
  const roleConfig = ROLE_CONFIG[hero.role] || {};
  const stats = {
    level: hero.level || 1,
    hp: hero.hp || 0,
    maxHp: hero.maxHp || 0,
    attack: hero.attack || 0,
    defense: hero.defense || 0,
    gold: hero.gold || 0,
    tokens: hero.tokens || 0,
    xp: hero.xp || 0,
    maxXp: hero.maxXp || 100
  };

  // Add profession info if available
  let professionText = '';
  if (hero.profession) {
    professionText = ` | Profession: ${hero.profession.type} Lv${hero.profession.level || 1}`;
  }

  // Add buff count if any
  const buffCount = hero.activeBuffs ? Object.keys(hero.activeBuffs).length : 0;
  const buffText = buffCount > 0 ? ` | ${buffCount} active buff${buffCount > 1 ? 's' : ''}` : '';

  const hpPercent = Math.floor((stats.hp / stats.maxHp) * 100);
  const xpPercent = Math.floor((stats.xp / stats.maxXp) * 100);

  const message = `${username}: Lv${stats.level} ${roleConfig.displayName || hero.role} | ` +
    `HP: ${stats.hp}/${stats.maxHp} (${hpPercent}%) | ATK: ${stats.attack} | DEF: ${stats.defense} | ` +
    `💰 ${stats.gold}g | 🪙 ${stats.tokens}t | XP: ${stats.xp}/${stats.maxXp} (${xpPercent}%)${professionText}${buffText}`;

  return {
    success: true,
    message,
    data: stats
  };
}

/**
 * Handle !gear command
 */
async function handleGearCommand(hero, username) {
  const equipment = hero.equipment || {};
  const gearList = [];
  
  // All equipment slots
  const slots = ['weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots'];
  for (const slot of slots) {
    const item = equipment[slot];
    if (item) {
      const stats = [];
      if (item.attack) stats.push(`+${item.attack} ATK`);
      if (item.defense) stats.push(`+${item.defense} DEF`);
      if (item.hp) stats.push(`+${item.hp} HP`);
      const statsText = stats.length > 0 ? ` (${stats.join(', ')})` : '';
      gearList.push(`${slot}: ${item.name}${statsText}`);
    }
  }

  // Show inventory count
  const inventory = hero.inventory || [];
  const inventoryText = inventory.length > 0 ? ` | Inventory: ${inventory.length} items` : '';

  const message = gearList.length > 0
    ? `${username}'s Gear: ${gearList.join(' | ')}${inventoryText}`
    : `${username}: No gear equipped. Use !shop to buy items.${inventoryText}`;

  return {
    success: true,
    message,
    data: { equipment, inventoryCount: inventory.length }
  };
}

/**
 * Handle !shop command
 */
async function handleShopCommand(hero, username) {
  const gold = hero.gold || 0;
  const message = `${username}: Shop - Potion (50g) | XP Boost (100g) | Sharpening (150g) | Polish (150g) | You have ${gold}g | Use !buy [item]`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !attack command
 */
async function handleAttackCommand(hero, args, username, battlefieldId) {
  const ATTACK_COOLDOWN = 5; // 5 seconds
  
  // Check cooldown
  if (isOnCooldown(hero, 'attack', ATTACK_COOLDOWN)) {
    const remaining = getCooldownRemaining(hero, 'attack', ATTACK_COOLDOWN);
    return {
      success: false,
      message: `@${username} Attack is on cooldown. Wait ${remaining}s.`
    };
  }

  // Update cooldown and last command time
  await updateCooldown(hero.id, 'attack');
  await db.collection('heroes').doc(hero.id).update({
    lastCommandTime: Date.now(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Broadcast attack command to battlefield
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(battlefieldId, {
    type: 'chat_command',
    command: 'attack',
    user: username,
    userId: hero.twitchUserId,
    heroId: hero.id,
    timestamp: Date.now()
  });

  const message = `@${username} attacks! (${ATTACK_COOLDOWN}s cooldown)`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, battlefieldId, cooldown: ATTACK_COOLDOWN }
  };
}

/**
 * Handle !heal command
 */
async function handleHealCommand(hero, args, username, battlefieldId) {
  const HEAL_COOLDOWN = 8; // 8 seconds
  
  // Check if hero is a healer
  const roleConfig = ROLE_CONFIG[hero.role] || {};
  if (roleConfig.category !== 'healer') {
    return {
      success: false,
      message: `@${username} Only healers can use !heal. You are a ${roleConfig.displayName || hero.role}.`
    };
  }

  // Check cooldown
  if (isOnCooldown(hero, 'heal', HEAL_COOLDOWN)) {
    const remaining = getCooldownRemaining(hero, 'heal', HEAL_COOLDOWN);
    return {
      success: false,
      message: `@${username} Heal is on cooldown. Wait ${remaining}s.`
    };
  }

  // Get all heroes in battlefield
  const battlefieldHeroes = await getBattlefieldHeroes(battlefieldId);
  
  // Determine target
  let targetHero = null;
  if (args[0]) {
    // Find hero by name (case-insensitive)
    const targetName = args[0].toLowerCase();
    targetHero = battlefieldHeroes.find(h => 
      (h.name || '').toLowerCase() === targetName ||
      (h.characterName || '').toLowerCase() === targetName
    );
    
    if (!targetHero) {
      return {
        success: false,
        message: `@${username} Hero "${args[0]}" not found in battlefield. Use !heal to auto-target lowest HP.`
      };
    }
  } else {
    // Auto-target: find hero with lowest HP percentage
    const aliveHeroes = battlefieldHeroes.filter(h => !h.isDead && h.hp > 0);
    if (aliveHeroes.length === 0) {
      return {
        success: false,
        message: `@${username} No alive heroes to heal.`
      };
    }
    
    // Find hero with lowest HP percentage
    targetHero = aliveHeroes.reduce((lowest, current) => {
      const lowestPercent = (lowest.hp || 0) / (lowest.maxHp || 1);
      const currentPercent = (current.hp || 0) / (current.maxHp || 1);
      return currentPercent < lowestPercent ? current : lowest;
    });
  }

  // Calculate healing based on healer's Intellect, Wisdom, Healing Power, and Spell Damage
  // Base healing scales from Intellect + Wisdom (like spell power)
  const totalIntellect = hero.intellect || 0;
  const totalWisdom = hero.wisdom || 0;
  
  // Base heal = Intellect * 1.0 + Wisdom * 0.5 (spell power scaling)
  // Fallback to level-based healing if no Int/Wis
  let baseHeal = (totalIntellect * 1.0) + (totalWisdom * 0.5);
  if (baseHeal < 1) {
    baseHeal = (hero.level || 1) * 5; // Fallback to level-based
  }
  
  // Add attack as a small bonus (10% contribution)
  baseHeal += (hero.attack || 0) * 0.1;
  
  // Healing Power % bonus (uncapped - better gear should heal more!)
  const healingPower = hero.healingPower || 0;
  baseHeal *= (1 + (healingPower * 0.01)); // 1% per point of healing power
  
  // Spell Damage also affects healing (healers use spell power for everything)
  const spellDamage = hero.spellDamage || 0;
  baseHeal *= (1 + (spellDamage * 0.01)); // 1% per point of spell damage
  
  // Divine Grace: 30% chance for 2x healing
  let divineGraceActive = false;
  if (Math.random() < 0.30) {
    divineGraceActive = true;
    baseHeal *= 2;
  }
  
  const healAmount = Math.floor(baseHeal);
  
  // Apply healing
  const newHp = Math.min((targetHero.hp || 0) + healAmount, targetHero.maxHp || targetHero.hp);
  const actualHeal = newHp - (targetHero.hp || 0);
  
  await db.collection('heroes').doc(targetHero.id).update({
    hp: newHp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Update healer's cooldown and last command time
  await updateCooldown(hero.id, 'heal');
  await db.collection('heroes').doc(hero.id).update({
    lastCommandTime: Date.now(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Broadcast heal command to battlefield
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(battlefieldId, {
    type: 'chat_command',
    command: 'heal',
    user: username,
    userId: hero.twitchUserId,
    heroId: hero.id,
    targetHeroId: targetHero.id,
    targetName: targetHero.name || targetHero.characterName,
    healAmount: actualHeal,
    timestamp: Date.now()
  });

  const targetName = targetHero.name || targetHero.characterName || 'target';
  const message = `@${username} heals ${targetName} for ${actualHeal} HP! (${targetName}: ${newHp}/${targetHero.maxHp} HP)${divineGraceActive ? ' ✨ Divine Grace!' : ''}`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, targetHeroId: targetHero.id, battlefieldId, healAmount: actualHeal, cooldown: HEAL_COOLDOWN }
  };
}

/**
 * Handle !cast command
 */
async function handleCastCommand(hero, args, username, battlefieldId) {
  const CAST_COOLDOWN = 10; // 10 seconds
  
  // Check cooldown
  if (isOnCooldown(hero, 'cast', CAST_COOLDOWN)) {
    const remaining = getCooldownRemaining(hero, 'cast', CAST_COOLDOWN);
    return {
      success: false,
      message: `@${username} Cast is on cooldown. Wait ${remaining}s.`
    };
  }

  // Get class-specific spell (simplified - can be expanded)
  const roleConfig = ROLE_CONFIG[hero.role] || {};
  const spellName = args[0] || 'ability';
  
  // Update cooldown and last command time
  await updateCooldown(hero.id, 'cast');
  await db.collection('heroes').doc(hero.id).update({
    lastCommandTime: Date.now(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Broadcast cast command to battlefield
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(battlefieldId, {
    type: 'chat_command',
    command: 'cast',
    user: username,
    userId: hero.twitchUserId,
    heroId: hero.id,
    spell: spellName,
    timestamp: Date.now()
  });

  const message = `@${username} casts ${spellName}! (${CAST_COOLDOWN}s cooldown)`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, battlefieldId, spell: spellName, cooldown: CAST_COOLDOWN }
  };
}

/**
 * Handle !defend command
 */
async function handleDefendCommand(hero, username, battlefieldId) {
  const DEFEND_COOLDOWN = 15; // 15 seconds
  const DEFEND_DURATION = 30; // 30 seconds
  
  // Check if hero is a tank
  const roleConfig = ROLE_CONFIG[hero.role] || {};
  if (roleConfig.category !== 'tank') {
    return {
      success: false,
      message: `@${username} Only tanks can use !defend. You are a ${roleConfig.displayName || hero.role}.`
    };
  }

  // Check cooldown
  if (isOnCooldown(hero, 'defend', DEFEND_COOLDOWN)) {
    const remaining = getCooldownRemaining(hero, 'defend', DEFEND_COOLDOWN);
    return {
      success: false,
      message: `@${username} Defend is on cooldown. Wait ${remaining}s.`
    };
  }

  // Apply defense buff (50% defense increase for 30 seconds)
  const activeBuffs = hero.activeBuffs || {};
  activeBuffs.defend = {
    defenseBonus: Math.floor((hero.defense || 0) * 0.5),
    expiresAt: Date.now() + (DEFEND_DURATION * 1000)
  };

  // Update cooldown and buffs
  await updateCooldown(hero.id, 'defend');
  await db.collection('heroes').doc(hero.id).update({
    activeBuffs: activeBuffs,
    lastCommandTime: Date.now(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Broadcast defend command to battlefield
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(battlefieldId, {
    type: 'chat_command',
    command: 'defend',
    user: username,
    userId: hero.twitchUserId,
    heroId: hero.id,
    duration: DEFEND_DURATION,
    timestamp: Date.now()
  });

  const message = `@${username} takes a defensive stance! +50% DEF for ${DEFEND_DURATION}s (${DEFEND_COOLDOWN}s cooldown)`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, battlefieldId, duration: DEFEND_DURATION, cooldown: DEFEND_COOLDOWN }
  };
}

/**
 * Handle !buy command
 */
async function handleBuyCommand(hero, args, username) {
  if (!args[0]) {
    return {
      success: false,
      message: `@${username} Usage: !buy [item]. Items: potion (50g), xpboost (100g), sharpening (150g), polish (150g). Use !shop to see all.`
    };
  }

  // Shop items configuration
  const shopItems = {
    'potion': { name: 'Health Potion', cost: 50, type: 'gold', item: { id: `potion_${Date.now()}`, name: 'Health Potion', slot: 'consumable', hp: 50, rarity: 'common' } },
    'healthpotion': { name: 'Health Potion', cost: 50, type: 'gold', item: { id: `potion_${Date.now()}`, name: 'Health Potion', slot: 'consumable', hp: 50, rarity: 'common' } },
    'xpboost': { name: 'XP Boost', cost: 100, type: 'gold', item: { id: `xpboost_${Date.now()}`, name: 'XP Boost', slot: 'consumable', xpMultiplier: 1.5, duration: 300, rarity: 'common' } },
    'sharpening': { name: 'Sharpening Stone', cost: 150, type: 'gold', item: { id: `sharpening_${Date.now()}`, name: 'Sharpening Stone', slot: 'consumable', attack: 10, duration: 300, rarity: 'uncommon' } },
    'polish': { name: 'Armor Polish', cost: 150, type: 'gold', item: { id: `polish_${Date.now()}`, name: 'Armor Polish', slot: 'consumable', defense: 10, duration: 300, rarity: 'uncommon' } }
  };

  const itemKey = args[0].toLowerCase();
  const shopItem = shopItems[itemKey];

  if (!shopItem) {
    return {
      success: false,
      message: `@${username} Item "${args[0]}" not found. Use !shop to see available items.`
    };
  }

  // Check if hero has enough gold
  const heroGold = hero.gold || 0;
  if (shopItem.type === 'gold' && heroGold < shopItem.cost) {
    return {
      success: false,
      message: `@${username} Not enough gold! Need ${shopItem.cost}g, have ${heroGold}g.`
    };
  }

  // Deduct cost
  const updateData = {
    gold: heroGold - shopItem.cost,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // Add item to inventory
  const inventory = hero.inventory || [];
  inventory.push(shopItem.item);
  updateData.inventory = inventory;

  await db.collection('heroes').doc(hero.id).update(updateData);

  const message = `@${username} bought ${shopItem.name} for ${shopItem.cost}g! (${heroGold - shopItem.cost}g remaining)`;

  return {
    success: true,
    message,
    data: { item: shopItem.name, cost: shopItem.cost, remainingGold: heroGold - shopItem.cost }
  };
}

/**
 * Handle !use command
 */
async function handleUseCommand(hero, args, username) {
  if (!args[0]) {
    return {
      success: false,
      message: `@${username} Usage: !use [item]. Use !gear to see your inventory.`
    };
  }

  const inventory = hero.inventory || [];
  if (inventory.length === 0) {
    return {
      success: false,
      message: `@${username} Your inventory is empty. Use !shop to buy items.`
    };
  }

  // Find item by name (case-insensitive, partial match)
  const itemName = args[0].toLowerCase();
  const itemIndex = inventory.findIndex(item => 
    (item.name || '').toLowerCase().includes(itemName) ||
    item.id.toLowerCase().includes(itemName)
  );

  if (itemIndex === -1) {
    return {
      success: false,
      message: `@${username} Item "${args[0]}" not found in inventory. Use !gear to see your items.`
    };
  }

  const item = inventory[itemIndex];
  const updateData = {
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  // Apply item effects
  if (item.hp) {
    // Health potion
    const newHp = Math.min((hero.hp || 0) + item.hp, hero.maxHp || hero.hp);
    updateData.hp = newHp;
    const actualHeal = newHp - (hero.hp || 0);
    
    await db.collection('heroes').doc(hero.id).update(updateData);
    
    // Remove item from inventory
    inventory.splice(itemIndex, 1);
    await db.collection('heroes').doc(hero.id).update({ inventory });
    
    const message = `@${username} used ${item.name}! Restored ${actualHeal} HP (${newHp}/${hero.maxHp} HP)`;
    
    return {
      success: true,
      message,
      data: { item: item.name, healAmount: actualHeal }
    };
  } else if (item.xpMultiplier || item.attack || item.defense) {
    // Buff item - apply to activeBuffs
    const activeBuffs = hero.activeBuffs || {};
    const buffId = `item_${item.id}`;
    activeBuffs[buffId] = {
      name: item.name,
      attack: item.attack || 0,
      defense: item.defense || 0,
      xpMultiplier: item.xpMultiplier || 1,
      expiresAt: Date.now() + ((item.duration || 300) * 1000)
    };
    
    updateData.activeBuffs = activeBuffs;
    
    // Remove item from inventory
    inventory.splice(itemIndex, 1);
    updateData.inventory = inventory;
    
    await db.collection('heroes').doc(hero.id).update(updateData);
    
    const duration = item.duration || 300;
    const message = `@${username} used ${item.name}! Active for ${duration}s.`;
    
    return {
      success: true,
      message,
      data: { item: item.name, duration }
    };
  } else {
    // Unknown item type
    return {
      success: false,
      message: `@${username} Cannot use ${item.name}. Unknown item type.`
    };
  }
}

/**
 * Handle !rest command
 */
async function handleRestCommand(hero, username, battlefieldId) {
  const REST_COOLDOWN = 300; // 5 minutes (300 seconds)
  const REST_DURATION = 60; // 1 minute pause
  
  // Check cooldown
  if (isOnCooldown(hero, 'rest', REST_COOLDOWN)) {
    const remaining = getCooldownRemaining(hero, 'rest', REST_COOLDOWN);
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    return {
      success: false,
      message: `@${username} Rest is on cooldown. Wait ${minutes}m ${seconds}s.`
    };
  }

  // Get all heroes in battlefield
  const battlefieldHeroes = await getBattlefieldHeroes(battlefieldId);
  
  // Heal all heroes to full HP and resurrect dead ones
  const updates = [];
  let healedCount = 0;
  let resurrectedCount = 0;
  
  for (const targetHero of battlefieldHeroes) {
    const updateData = {};
    let needsUpdate = false;
    
    if (targetHero.isDead) {
      // Resurrect with 50% HP
      updateData.isDead = false;
      updateData.deathTime = null;
      updateData.hp = Math.floor((targetHero.maxHp || 100) * 0.5);
      needsUpdate = true;
      resurrectedCount++;
    } else if (targetHero.hp < targetHero.maxHp) {
      // Heal to full
      updateData.hp = targetHero.maxHp || targetHero.hp;
      needsUpdate = true;
      healedCount++;
    }
    
    if (needsUpdate) {
      updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
      updates.push(db.collection('heroes').doc(targetHero.id).update(updateData));
    }
  }
  
  await Promise.all(updates);

  // Update rest cooldown and last command time
  await updateCooldown(hero.id, 'rest');
  await db.collection('heroes').doc(hero.id).update({
    lastCommandTime: Date.now(),
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Broadcast rest command to battlefield
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(battlefieldId, {
    type: 'chat_command',
    command: 'rest',
    user: username,
    userId: hero.twitchUserId,
    heroId: hero.id,
    duration: REST_DURATION,
    healedCount,
    resurrectedCount,
    timestamp: Date.now()
  });

  const resultParts = [];
  if (healedCount > 0) resultParts.push(`${healedCount} healed`);
  if (resurrectedCount > 0) resultParts.push(`${resurrectedCount} resurrected`);
  const resultText = resultParts.length > 0 ? ` (${resultParts.join(', ')})` : '';
  
  const message = `@${username} calls for rest! Party recovers${resultText}. ${REST_DURATION}s pause (${Math.floor(REST_COOLDOWN / 60)}min cooldown)`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, battlefieldId, duration: REST_DURATION, cooldown: REST_COOLDOWN, healedCount, resurrectedCount }
  };
}

/**
 * Handle !claim command
 */
export async function handleClaimCommand(hero, username) {
  const now = Date.now();
  const lastClaim = hero.lastTokenClaim || hero.joinedAt || now;
  const timeSinceClaim = now - lastClaim;
  
  // Base idle tokens: 2.5 per hour
  let tokensPerHour = 2.5;
  
  // Founder pack bonuses (add to base rate)
  const founderTier = hero.founderPackTier || null;
  const founderBonuses = {
    'bronze': 0.5,   // +0.5 tokens/hour (total: 3.0)
    'silver': 1.0,   // +1.0 tokens/hour (total: 3.5)
    'gold': 1.5,     // +1.5 tokens/hour (total: 4.0)
    'platinum': 2.0  // +2.0 tokens/hour (total: 4.5)
  };
  
  if (founderTier) {
    const bonus = founderBonuses[founderTier.toLowerCase()] || 0;
    if (bonus > 0) {
      tokensPerHour += bonus;
      console.log(`[Claim] ${username} has ${founderTier} founder pack: +${bonus} tokens/hour (total: ${tokensPerHour}/hr)`);
    }
  }
  
  const hoursSinceClaim = timeSinceClaim / (1000 * 60 * 60);
  const tokensToClaim = Math.floor(hoursSinceClaim * tokensPerHour);
  
  if (tokensToClaim <= 0) {
    const minutesUntilNext = Math.ceil((3600000 - timeSinceClaim) / 60000);
    return {
      success: false,
      message: `@${username} No tokens available yet. Next token in ${minutesUntilNext} minutes.`
    };
  }

  // Cap at reasonable amount (e.g., 24 hours worth based on boosted rate)
  const maxTokens = Math.floor(tokensPerHour * 24); // 24 hours worth of tokens at current rate
  const actualTokens = Math.min(tokensToClaim, maxTokens);
  
  const newTokens = (hero.tokens || 0) + actualTokens;
  const newTotalIdleTokens = (hero.totalIdleTokens || 0) + actualTokens;

  await db.collection('heroes').doc(hero.id).update({
    tokens: newTokens,
    totalIdleTokens: newTotalIdleTokens,
    lastTokenClaim: now,
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const hours = Math.floor(hoursSinceClaim);
  let message = `@${username} claimed ${actualTokens} idle tokens! (Total: ${newTokens} tokens)`;
  
  // Show founder bonus in message if applicable
  if (founderTier && founderBonuses[founderTier.toLowerCase()]) {
    const tierName = founderTier.charAt(0).toUpperCase() + founderTier.slice(1);
    message += ` [${tierName} Founder: ${tokensPerHour.toFixed(1)}/hr]`;
  }

  return {
    success: true,
    message,
    data: { 
      tokensClaimed: actualTokens, 
      totalTokens: newTokens, 
      hoursSinceClaim: hours, 
      tokensPerHour,
      lastTokenClaim: now // Include timestamp of when claim was made
    }
  };
}

/**
 * Handle !tokens command
 */
async function handleTokensCommand(hero, username) {
  const tokens = hero.tokens || 0;
  const message = `${username}: You have ${tokens} tokens. Use !claim to claim idle tokens.`;

  return {
    success: true,
    message,
    data: { tokens }
  };
}

/**
 * Handle !classes command
 */
async function handleClassesCommand(username) {
  const tanks = Object.keys(ROLE_CONFIG).filter(k => ROLE_CONFIG[k].category === 'tank');
  const healers = Object.keys(ROLE_CONFIG).filter(k => ROLE_CONFIG[k].category === 'healer');
  const dps = Object.keys(ROLE_CONFIG).filter(k => ROLE_CONFIG[k].category === 'dps');

  const message = `${username}: Classes - Tanks: ${tanks.length} | Healers: ${healers.length} | DPS: ${dps.length} | Use !join [class] to join`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !help command
 */
async function handleHelpCommand(username) {
  const combat = '!attack (!a) !heal (!h) !defend !cast !dispel !rest !potion';
  const info = '!stats (!s) !gear (!g) !heroes !classes';
  const shop = '!shop !buy !use !claim !tokens';
  const profession = '!profession !gather !recipes !craft !elixirs';
  const utility = '!join !leave !auto !quest !skills !leaderboard';
  
  const message = `${username}: Commands → Combat: ${combat} | Info: ${info} | Shop: ${shop} | Profession: ${profession} | Utility: ${utility} | !help`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !leave command
 */
async function handleLeaveCommand(hero, username, battlefieldId) {
  try {
    if (!hero || !hero.id) {
      return {
        success: false,
        message: `@${username} Error: Hero data not found.`
      };
    }

    // Capture oldBattlefieldId BEFORE checking if document exists
    // This is critical because we need it for broadcasting even if the document is deleted
    const oldBattlefieldId = hero.currentBattlefieldId || 'world';
    
    // Helper function to broadcast hero_left_battlefield
    // Define this FIRST, before any async operations, to ensure it's always available
    // Use function declaration instead of const to avoid temporal dead zone issues
    async function broadcastHeroLeft() {
      if (oldBattlefieldId && oldBattlefieldId !== 'world') {
        try {
          const { broadcastToRoom } = await import('../websocket/server.js');
          const heroName = hero.name || hero.characterName || username;
          
          // Convert battlefield ID (twitch:username or twitch:numericId) to Twitch ID (numeric) for WebSocket room
          let streamerTwitchId = null;
          if (oldBattlefieldId.startsWith('twitch:')) {
            const identifier = oldBattlefieldId.replace('twitch:', '').trim();
            
            // Check if it's a numeric Twitch ID (like "1087777297")
            if (/^\d+$/.test(identifier)) {
              // It's already a numeric ID, use it directly
              streamerTwitchId = identifier;
            } else {
              // It's a username, look up streamer's Twitch ID from their hero document
              const streamerUsername = identifier.toLowerCase();
              const streamerHeroSnapshot = await db.collection('heroes')
                .where('twitchUsername', '==', streamerUsername)
                .limit(1)
                .get();
              
              if (!streamerHeroSnapshot.empty) {
                const streamerHero = streamerHeroSnapshot.docs[0].data();
                streamerTwitchId = streamerHero.twitchUserId || streamerHero.twitchId;
              }
            }
          } else {
            // If it's already a numeric ID, use it directly
            streamerTwitchId = oldBattlefieldId;
          }
          
          if (streamerTwitchId) {
            console.log(`📡 Broadcasting hero_left_battlefield to Twitch ID: ${streamerTwitchId} (BEFORE Firebase update, from battlefield: ${oldBattlefieldId})`);
            broadcastToRoom(String(streamerTwitchId), {
              type: 'hero_left_battlefield',
              hero: { ...hero, id: hero.id },
              message: `${heroName} has left the battlefield`,
              timestamp: Date.now()
            });
          } else {
            console.warn(`⚠️ Could not find streamer Twitch ID for battlefield: ${oldBattlefieldId}`);
          }
        } catch (broadcastError) {
          console.warn('Failed to broadcast hero_left_battlefield:', broadcastError);
          // Don't fail the command if broadcast fails
        }
      }
    }
    
    // Check if hero document still exists before trying to update
    const heroRef = db.collection('heroes').doc(hero.id);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      // Hero was already deleted - just broadcast that they left
      console.warn(`⚠️ [Leave] Hero document ${hero.id} does not exist - hero may have been deleted`);
      await broadcastHeroLeft();
      
      return {
        success: true,
        message: `@${username} You left the party!`
      };
    }
    
    // ✅ BROADCAST FIRST (before updating Firebase) - ensures immediate removal
    // This is critical when users join another battlefield - old battlefield needs immediate removal
    await broadcastHeroLeft();
    
    // ✅ THEN update Firebase (after broadcast)
    // Firebase listener will also remove the hero, but WebSocket is faster
    // Use FieldValue.delete() to remove the field, or set to null as fallback
    try {
      console.log(`🔄 [Leave] Updating Firebase for hero ${hero.id} (${hero.name || username}) - removing currentBattlefieldId`);
      console.log(`   Current battlefieldId: ${oldBattlefieldId}`);
      
      // First try with FieldValue.delete() to remove the field entirely
      await heroRef.update({
        currentBattlefieldId: admin.firestore.FieldValue.delete(),
        currentBattlefieldType: admin.firestore.FieldValue.delete(),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Wait a moment for the update to propagate
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify the update completed by reading the document back
      const updatedDoc = await heroRef.get();
      if (updatedDoc.exists) {
        const updatedData = updatedDoc.data();
        const stillHasBattlefieldId = updatedData.currentBattlefieldId !== null && updatedData.currentBattlefieldId !== undefined;
        if (stillHasBattlefieldId) {
          console.warn(`⚠️ [Leave] FieldValue.delete() didn't work - hero still has currentBattlefieldId: ${updatedData.currentBattlefieldId}`);
          console.warn(`   Trying fallback: setting to null explicitly`);
          
          // Fallback: set to null explicitly
          await heroRef.update({
            currentBattlefieldId: null,
            currentBattlefieldType: null,
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          // Verify again
          await new Promise(resolve => setTimeout(resolve, 200));
          const retryDoc = await heroRef.get();
          if (retryDoc.exists) {
            const retryData = retryDoc.data();
            if (retryData.currentBattlefieldId !== null && retryData.currentBattlefieldId !== undefined) {
              console.error(`❌ [Leave] Both delete() and null failed - hero still has currentBattlefieldId: ${retryData.currentBattlefieldId}`);
              console.error(`   Attempting final fallback: using set() with merge`);
              
              // Final fallback: use set() with merge to force the update
              try {
                const heroData = retryDoc.data();
                const finalData = { ...heroData };
                delete finalData.currentBattlefieldId;
                delete finalData.currentBattlefieldType;
                finalData.lastActiveAt = admin.firestore.FieldValue.serverTimestamp();
                finalData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
                
                await heroRef.set(finalData, { merge: true });
                
                // Final verification
                await new Promise(resolve => setTimeout(resolve, 200));
                const finalDoc = await heroRef.get();
                if (finalDoc.exists) {
                  const finalData = finalDoc.data();
                  if (finalData.currentBattlefieldId === null || finalData.currentBattlefieldId === undefined) {
                    console.log(`✅ [Leave] Final set() fallback succeeded - hero ${hero.id} currentBattlefieldId removed`);
                  } else {
                    console.error(`❌ [Leave] ALL methods failed - hero ${hero.id} still has currentBattlefieldId: ${finalData.currentBattlefieldId}`);
                    console.error(`   This is a critical error - the hero will remain stuck in the battlefield`);
                  }
                }
              } catch (setError) {
                console.error(`❌ [Leave] Final set() fallback also failed:`, setError);
              }
            } else {
              console.log(`✅ [Leave] Fallback null update succeeded - hero ${hero.id} currentBattlefieldId set to null`);
            }
          }
        } else {
          console.log(`✅ [Leave] Firebase update confirmed - hero ${hero.id} currentBattlefieldId removed (field deleted)`);
        }
      } else {
        console.warn(`⚠️ [Leave] Hero document ${hero.id} no longer exists after update`);
      }
    } catch (updateError) {
      // If update fails (e.g., document was deleted), we already broadcasted
      console.error('❌ [Leave] Failed to update hero document:', updateError);
      console.error('   Error code:', updateError.code);
      console.error('   Error message:', updateError.message);
      if (updateError.stack) {
        console.error('   Stack:', updateError.stack);
      }
      
      // Try one more time with a direct set operation (not update) as last resort
      try {
        console.log(`🔄 [Leave] Attempting direct set operation as last resort for hero ${hero.id}...`);
        const heroData = heroDoc.data();
        const updatedData = { ...heroData };
        delete updatedData.currentBattlefieldId;
        delete updatedData.currentBattlefieldType;
        updatedData.lastActiveAt = admin.firestore.FieldValue.serverTimestamp();
        updatedData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        await heroRef.set(updatedData, { merge: true });
        
        // Verify the set operation
        await new Promise(resolve => setTimeout(resolve, 100));
        const verifyDoc = await heroRef.get();
        if (verifyDoc.exists) {
          const verifyData = verifyDoc.data();
          if (verifyData.currentBattlefieldId === null || verifyData.currentBattlefieldId === undefined) {
            console.log(`✅ [Leave] Direct set operation succeeded - hero ${hero.id} currentBattlefieldId removed`);
          } else {
            console.error(`❌ [Leave] Direct set operation failed - hero still has currentBattlefieldId: ${verifyData.currentBattlefieldId}`);
          }
        }
      } catch (setError) {
        console.error(`❌ [Leave] Direct set operation also failed:`, setError);
        // Don't fail the command if Firebase update fails - WebSocket broadcast already sent
        // The user will see the hero removed immediately via WebSocket
        // Firebase will eventually sync, or the user can refresh
      }
    }

    const message = `@${username} You left the party! Use !rejoin to return with your character.`;

    return {
      success: true,
      message,
      data: { heroId: hero.id, battlefieldId: oldBattlefieldId }
    };
  } catch (error) {
    console.error('Error in handleLeaveCommand:', error);
    return {
      success: false,
      message: `@${username} Error processing leave command: ${error.message}`
    };
  }
}

/**
 * Handle !heroes command - List all characters for user
 */
async function handleHeroesCommand(username, userId) {
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', userId)
    .get();

  if (heroesSnapshot.empty) {
    return {
      success: true,
      message: `@${username} You have no saved characters. Use !join [class] to create one!`
    };
  }

  // Sort by lastActiveAt desc (same order as !join uses)
  const heroes = heroesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  heroes.sort((a, b) => {
    const aTime = a.lastActiveAt?.toMillis?.() ?? new Date(a.lastActiveAt ?? 0).getTime();
    const bTime = b.lastActiveAt?.toMillis?.() ?? new Date(b.lastActiveAt ?? 0).getTime();
    return bTime - aTime;
  });

  const heroList = heroes.map((h, index) => {
    const roleName = ROLE_CONFIG[h.role]?.displayName || h.role;
    return `${index + 1}. ${roleName} Lv${h.level || 1}`;
  }).join(' | ');

  // Calculate shared gold and tokens
  const sharedGold = heroes.reduce((sum, h) => sum + (h.gold || 0), 0);
  const sharedTokens = heroes.reduce((sum, h) => sum + (h.tokens || 0), 0);

  const message = `@${username} Characters (${heroes.length}): ${heroList} | Shared: ${sharedGold}g ${sharedTokens}t | Use !join [number] to play`;

  return {
    success: true,
    message,
    data: { heroes: heroes.length }
  };
}

/**
 * Handle !rejoin command by character index
 */
async function handleRejoinByIndexCommand(indexStr, username, userId, battlefieldId) {
  const index = parseInt(indexStr, 10) - 1; // Convert to 0-based index
  
  // Get all heroes for this user (fetch without orderBy to avoid index requirement)
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', userId)
    .get();

  if (heroesSnapshot.empty) {
    return {
      success: false,
      message: `@${username} No characters found. Use !join [class] to create one!`
    };
  }

  // Sort by lastActiveAt desc (same order as !heroes)
  // Filter out deleted heroes by verifying they still exist
  // Use batch read to check all heroes at once for better performance
  const heroRefs = heroesSnapshot.docs.map(doc => db.collection('heroes').doc(doc.id));
  const heroChecks = await Promise.all(heroRefs.map(ref => ref.get()));
  
  const validHeroes = [];
  for (let i = 0; i < heroesSnapshot.docs.length; i++) {
    const doc = heroesSnapshot.docs[i];
    const heroCheck = heroChecks[i];
    if (heroCheck.exists) {
      validHeroes.push({ id: doc.id, ...doc.data() });
    } else {
      console.warn(`⚠️ [Rejoin] Skipping deleted hero document: ${doc.id}`);
    }
  }
  
  validHeroes.sort((a, b) => {
    const aTime = a.lastActiveAt?.toMillis?.() ?? new Date(a.lastActiveAt ?? 0).getTime();
    const bTime = b.lastActiveAt?.toMillis?.() ?? new Date(b.lastActiveAt ?? 0).getTime();
    return bTime - aTime;
  });
  
  if (index < 0 || index >= validHeroes.length) {
    return {
      success: false,
      message: `@${username} Invalid character number. Use !heroes to see your characters.`
    };
  }
  
  const selectedHero = validHeroes[index];
  
  // Re-fetch the hero document to get the latest state (in case !leave just updated it)
  const heroDocRef = db.collection('heroes').doc(selectedHero.id);
  const latestHeroDoc = await heroDocRef.get();
  
  // Check if hero document still exists
  if (!latestHeroDoc.exists) {
    return {
      success: false,
      message: `@${username} Character not found. It may have been deleted. Use !join [class] to create a new character.`
    };
  }
  
  const latestHero = { id: latestHeroDoc.id, ...latestHeroDoc.data() };
  
  // CRITICAL: Remove ALL other heroes of this user from ALL battlefields
  // Users can have multiple heroes, but only ONE hero can be on battlefields at a time
  try {
    const allUserHeroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .get();
    
    const otherHeroes = allUserHeroesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(h => h.id !== selectedHero.id && h.currentBattlefieldId); // Other heroes that are on battlefields
    
    if (otherHeroes.length > 0) {
      console.log(`[Rejoin] User ${username} has ${otherHeroes.length} other heroes on battlefields. Removing them...`);
      
      for (const otherHero of otherHeroes) {
        const otherHeroRef = db.collection('heroes').doc(otherHero.id);
        await otherHeroRef.update({
          currentBattlefieldId: admin.firestore.FieldValue.delete(),
          currentBattlefieldType: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ [Rejoin] Removed hero ${otherHero.id} (${otherHero.name}) from battlefield ${otherHero.currentBattlefieldId}`);
      }
    }
  } catch (cleanupError) {
    console.error('❌ [Rejoin] Error cleaning up other heroes:', cleanupError);
    // Continue even if cleanup fails - don't block the rejoin
  }
  
  // Check if hero is already in this battlefield
  // Allow joining if currentBattlefieldId is null/undefined (they left but Firebase might not have updated)
  // Also allow if they're trying to rejoin the same battlefield (they might have just left)
  if (latestHero.currentBattlefieldId === battlefieldId && latestHero.currentBattlefieldId != null) {
    const roleName = ROLE_CONFIG[latestHero.role]?.displayName || latestHero.role;
    // If they're already in this battlefield, just confirm and update lastActiveAt
    try {
      await heroDocRef.update({
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return {
        success: true,
        message: `@${username} You're already in the party as ${roleName} Lv${latestHero.level || 1}!`
      };
    } catch (updateError) {
      // If update fails (document deleted), return error
      if (updateError.code === 5) { // NOT_FOUND
        return {
          success: false,
          message: `@${username} Character not found. It may have been deleted. Use !join [class] to create a new character.`
        };
      }
      throw updateError;
    }
  }

  // Update hero's battlefield (they're either joining for first time or moving from another battlefield)
  // Setting new currentBattlefieldId automatically removes hero from old battlefield
  try {
    await heroDocRef.update({
      currentBattlefieldId: battlefieldId,
      currentBattlefieldType: 'streamer',
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ [Rejoin] Hero ${selectedHero.id} assigned to battlefield ${battlefieldId}`);
  } catch (updateError) {
    // If update fails (document deleted), return error
    if (updateError.code === 5) { // NOT_FOUND
      return {
        success: false,
        message: `@${username} Character not found. It may have been deleted. Use !join [class] to create a new character.`
      };
    }
    throw updateError;
  }

  const roleName = ROLE_CONFIG[selectedHero.role]?.displayName || selectedHero.role;
  const gold = selectedHero.gold || 0;
  const tokens = selectedHero.tokens || 0;
  
  return {
    success: true,
    message: `@${username} Welcome back! Rejoined as ${roleName} Level ${selectedHero.level || 1} (${gold}g ${tokens}t shared)`
  };
}

/**
 * Handle !rejoin command
 */
async function handleRejoinCommand(hero, args, username, userId, battlefieldId) {
  // Rejoin is similar to join but for existing characters
  if (!hero) {
    return {
      success: false,
      message: `@${username} No character found. Use !join [class] to create one!`
    };
  }
  
  // Re-fetch the hero document to get the latest state (in case !leave just updated it)
  const heroDocRef = db.collection('heroes').doc(hero.id);
  const latestHeroDoc = await heroDocRef.get();
  
  // Check if hero document still exists
  if (!latestHeroDoc.exists) {
    return {
      success: false,
      message: `@${username} Character not found. It may have been deleted. Use !join [class] to create a new character.`
    };
  }
  
  const latestHero = { id: latestHeroDoc.id, ...latestHeroDoc.data() };
  
  // CRITICAL: Remove ALL other heroes of this user from ALL battlefields
  // Users can have multiple heroes, but only ONE hero can be on battlefields at a time
  try {
    const allUserHeroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .get();
    
    const otherHeroes = allUserHeroesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(h => h.id !== hero.id && h.currentBattlefieldId); // Other heroes that are on battlefields
    
    if (otherHeroes.length > 0) {
      console.log(`[Rejoin] User ${username} has ${otherHeroes.length} other heroes on battlefields. Removing them...`);
      
      for (const otherHero of otherHeroes) {
        const otherHeroRef = db.collection('heroes').doc(otherHero.id);
        await otherHeroRef.update({
          currentBattlefieldId: admin.firestore.FieldValue.delete(),
          currentBattlefieldType: admin.firestore.FieldValue.delete(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ [Rejoin] Removed hero ${otherHero.id} (${otherHero.name}) from battlefield ${otherHero.currentBattlefieldId}`);
      }
    }
  } catch (cleanupError) {
    console.error('❌ [Rejoin] Error cleaning up other heroes:', cleanupError);
    // Continue even if cleanup fails - don't block the rejoin
  }
  
  // If hero is already in battlefield, just confirm and update lastActiveAt
  // Allow joining if currentBattlefieldId is null/undefined (they left but Firebase might not have updated)
  if (latestHero.currentBattlefieldId === battlefieldId && latestHero.currentBattlefieldId != null) {
    const roleName = ROLE_CONFIG[latestHero.role]?.displayName || latestHero.role;
    try {
      await heroDocRef.update({
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return {
        success: true,
        message: `@${username} You're already in the party as ${roleName} Lv${latestHero.level || 1}!`
      };
    } catch (updateError) {
      // If update fails (document deleted), return error
      if (updateError.code === 5) { // NOT_FOUND
        return {
          success: false,
          message: `@${username} Character not found. It may have been deleted. Use !join [class] to create a new character.`
        };
      }
      throw updateError;
    }
  }
  
  // If hero exists but not in this battlefield, rejoin with that hero
  // Setting new currentBattlefieldId automatically removes hero from old battlefield
  try {
    await heroDocRef.update({
      currentBattlefieldId: battlefieldId,
      currentBattlefieldType: 'streamer',
      lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ [Rejoin] Hero ${hero.id} assigned to battlefield ${battlefieldId}`);

    const roleName = ROLE_CONFIG[latestHero.role]?.displayName || latestHero.role;
    return {
      success: true,
      message: `@${username} Rejoined as ${roleName} Lv${latestHero.level || 1}!`
    };
  } catch (updateError) {
    // If update fails (document deleted), return error
    if (updateError.code === 5) { // NOT_FOUND
      return {
        success: false,
        message: `@${username} Character not found. It may have been deleted. Use !join [class] to create a new character.`
      };
    }
    throw updateError;
  }

  // No hero found - need to use !join or !rejoin [number]
  return {
    success: false,
    message: `@${username} No character found. Use !join [class] to create one!`
  };
}

/**
 * Handle !switch command - Switch class
 */
async function handleSwitchCommand(hero, args, username, userId, battlefieldId) {
  if (!args[0]) {
    return {
      success: false,
      message: `@${username} Usage: !switch [class] (e.g., !switch guardian)`
    };
  }

  const newClass = args[0].toLowerCase();
  if (!ROLE_CONFIG[newClass]) {
    return {
      success: false,
      message: `@${username} "${newClass}" is not a valid class! Use !classes to see all available classes.`
    };
  }

  // TODO: Implement class switching logic (costs tokens/gold)
  const message = `@${username} Class switching functionality coming soon! Use !classes to see available classes.`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !auto command - Toggle auto-buy
 */
async function handleAutoCommand(hero, username, battlefieldId) {
  const autoBuy = !hero.autoBuy;
  
  await db.collection('heroes').doc(hero.id).update({
    autoBuy: autoBuy,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const status = autoBuy ? 'ENABLED' : 'DISABLED';
  const emoji = autoBuy ? '✅' : '❌';
  const message = `${username}: Auto-Buy ${status}! ${autoBuy ? 'Will automatically purchase potions and buffs.' : 'Will not auto-purchase items.'}`;

  return {
    success: true,
    message,
    data: { autoBuy }
  };
}

/**
 * Handle !quest command
 */
async function handleQuestCommand(hero, args, username, userId) {
  // TODO: Implement quest claiming logic
  const message = `${username}: Quest system coming soon! Check the website for quest progress.`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !potion command - Use a health potion from inventory
 */
async function handlePotionCommand(hero, username, userId) {
  try {
    const inventory = hero.inventory || [];
    
    // Find a health potion
    const potionIndex = inventory.findIndex(item => 
      item.itemKey === 'healthpotion' || 
      item.type === 'potion' ||
      (item.name && item.name.toLowerCase().includes('health potion'))
    );
    
    if (potionIndex === -1) {
      return {
        success: false,
        message: `@${username} You don't have any Health Potions! Buy some from the shop (!shop).`
      };
    }
    
    const potion = inventory[potionIndex];
    const currentHp = hero.hp || 0;
    const maxHp = hero.maxHp || 100;
    const healAmount = Math.floor(maxHp * 0.5); // Heal 50% of max HP
    const newHp = Math.min(maxHp, currentHp + healAmount);
    const actualHeal = newHp - currentHp;
    
    // Overheal converts to shield
    const overheal = healAmount - actualHeal;
    const newShield = (hero.shield || 0) + overheal;
    
    // Remove potion from inventory
    inventory.splice(potionIndex, 1);
    
    // Update hero
    await db.collection('heroes').doc(hero.id).update({
      hp: newHp,
      shield: newShield,
      inventory: inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const shieldText = newShield > 0 ? ` (+${overheal} shield)` : '';
    return {
      success: true,
      message: `@${username} Used Health Potion! Restored ${actualHeal} HP${shieldText}. (${newHp}/${maxHp} HP)`
    };
  } catch (error) {
    console.error('Error using potion:', error);
    return {
      success: false,
      message: `@${username} Failed to use potion. Please try again.`
    };
  }
}

/**
 * Handle !profession command
 */
async function handleProfessionCommand(hero, args, username) {
  if (!args[0]) {
    const profession = hero.profession || 'none';
    return {
      success: true,
      message: `@${username} Current profession: ${profession}. Use !profession [alchemist|blacksmith|enchanter] to set.`
    };
  }

  const profession = args[0].toLowerCase();
  const validProfessions = ['alchemist', 'blacksmith', 'enchanter'];
  
  if (!validProfessions.includes(profession)) {
    return {
      success: false,
      message: `@${username} Invalid profession. Choose: alchemist, blacksmith, or enchanter.`
    };
  }

  await db.collection('heroes').doc(hero.id).update({
    profession: profession,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    success: true,
    message: `@${username} Profession set to ${profession}! Use !gather and !craft to use it.`
  };
}

/**
 * Handle !gather command
 */
async function handleGatherCommand(hero, username, battlefieldId) {
  if (!hero.profession) {
    return {
      success: false,
      message: `@${username} You need a profession first! Use !profession [alchemist|blacksmith|enchanter]`
    };
  }

  // TODO: Implement gathering logic
  await db.collection('heroes').doc(hero.id).update({
    lastCommandTime: Date.now(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const message = `${username} gathers materials! Gathering functionality coming soon.`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, battlefieldId }
  };
}

/**
 * Handle !recipes command
 */
async function handleRecipesCommand(hero, args, username) {
  if (!hero.profession) {
    return {
      success: false,
      message: `@${username} You need a profession first! Use !profession [herbalism|mining|enchanting]`
    };
  }

  const professionType = hero.profession.type;
  
  // Define recipes by profession type
  const recipes = {
    herbalism: [
      'basic_potion',
      'powerful_potion',
      'superior_potion',
      'legendary_potion',
      'basic_elixir',
      'powerful_elixir',
      'superior_elixir',
      'legendary_elixir'
    ],
    mining: [
      'iron_whetstone',
      'steel_whetstone',
      'mithril_whetstone',
      'adamantite_whetstone',
      'iron_plating',
      'steel_plating',
      'mithril_plating',
      'adamantite_plating',
      'iron_reinforcement',
      'steel_reinforcement',
      'mithril_reinforcement',
      'adamantite_reinforcement',
      'gem_socket'
    ],
    enchanting: [
      'minor_fiery_weapon',
      'minor_vampiric',
      'minor_arcane',
      'fiery_weapon',
      'vampiric',
      'arcane',
      'legendary_fiery_weapon',
      'legendary_vampiric',
      'legendary_arcane',
      'swiftness_rune',
      'resilience_rune',
      'power_rune'
    ]
  };

  const professionRecipes = recipes[professionType] || [];
  
  if (professionRecipes.length === 0) {
    return {
      success: false,
      message: `@${username} No recipes found for profession: ${professionType}`
    };
  }

  // Format recipe names (replace underscores with spaces, capitalize words)
  const formatRecipeName = (recipeKey) => {
    return recipeKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Create numbered list
  const recipeList = professionRecipes
    .map((recipe, index) => `${index + 1}. ${formatRecipeName(recipe)}`)
    .join(', ');

  const professionDisplayName = professionType.charAt(0).toUpperCase() + professionType.slice(1);
  const message = `@${username} Recipes (${professionDisplayName}): ${recipeList}`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !craft command
 */
async function handleCraftCommand(hero, args, username, battlefieldId) {
  if (!args[0]) {
    return {
      success: false,
      message: `@${username} Usage: !craft [item] (e.g., !craft healthpotion)`
    };
  }

  if (!hero.profession) {
    return {
      success: false,
      message: `@${username} You need a profession first! Use !profession [alchemist|blacksmith|enchanter]`
    };
  }

  // TODO: Implement crafting logic
  await db.collection('heroes').doc(hero.id).update({
    lastCommandTime: Date.now(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const message = `${username}: Crafting functionality coming soon!`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, battlefieldId }
  };
}

/**
 * Handle !elixirs command
 */
async function handleElixirsCommand(hero, username) {
  // TODO: Implement elixir listing
  const message = `${username}: Elixir system coming soon! Check the website for available elixirs.`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !skills command
 */
async function handleSkillsCommand(hero, username) {
  const skillPoints = hero.skillPoints || 0;
  const skills = hero.skills || {};
  
  const message = `${username}: Skill Points: ${skillPoints} | Skills system coming soon! Check the website.`;

  return {
    success: true,
    message,
    data: { skillPoints, skills }
  };
}

/**
 * Handle !dispel command
 */
async function handleDispelCommand(hero, args, username, battlefieldId) {
  // TODO: Implement dispel logic
  await db.collection('heroes').doc(hero.id).update({
    lastCommandTime: Date.now(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  const target = args[0] || 'self';
  const message = `${username} dispels debuffs from ${target}! Dispel functionality coming soon.`;

  return {
    success: true,
    message,
    data: { heroId: hero.id, battlefieldId }
  };
}

/**
 * Handle !leaderboard command
 */
async function handleLeaderboardCommand(hero, username) {
  // TODO: Implement leaderboard logic
  const category = ROLE_CONFIG[hero.role]?.category || hero.role;
  const message = `${username}: Leaderboard system coming soon! Check the website for rankings.`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !level command (admin only)
 */
async function handleLevelCommand(hero, args, username, userId, streamerUsername, battlefieldId) {
  if (!args[0] || !args[1]) {
    return {
      success: false,
      message: `@${username} Usage: !level [username] [level] (e.g., !level ${streamerUsername} 25)`
    };
  }

  const targetUsername = args[0].toLowerCase();
  const targetLevel = parseInt(args[1]);

  if (isNaN(targetLevel) || targetLevel < 1 || targetLevel > 100) {
    return {
      success: false,
      message: `@${username} Invalid level. Must be between 1 and 100.`
    };
  }

  // Find target hero
  const targetHeroesSnapshot = await db.collection('heroes')
    .where('twitchUsername', '==', targetUsername)
    .where('currentBattlefieldId', '==', battlefieldId)
    .limit(1)
    .get();

  if (targetHeroesSnapshot.empty) {
    return {
      success: false,
      message: `@${username} Hero "${targetUsername}" not found in battlefield.`
    };
  }

  const targetHeroDoc = targetHeroesSnapshot.docs[0];
  await db.collection('heroes').doc(targetHeroDoc.id).update({
    level: targetLevel,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    success: true,
    message: `${username} set ${targetUsername}'s level to ${targetLevel}!`
  };
}

/**
 * Handle !grantlegendary command (admin only)
 */
async function handleGrantLegendaryCommand(username, userId, streamerUsername, battlefieldId) {
  // TODO: Implement grant legendary gear to all heroes
  const message = `${username}: Grant legendary functionality coming soon!`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !push command (admin only)
 */
async function handlePushCommand(username, userId, streamerUsername, battlefieldId) {
  // TODO: Implement push to Firebase
  const message = `${username}: Push to Firebase functionality coming soon!`;

  return {
    success: true,
    message
  };
}

/**
 * Handle !sync command (admin only)
 */
async function handleSyncCommand(username, userId, streamerUsername, battlefieldId) {
  // TODO: Implement sync from Firebase
  const message = `${username}: Sync from Firebase functionality coming soon!`;

  return {
    success: true,
    message
  };
}

// ============================================================================
// QUEUE SYSTEM COMMANDS
// ============================================================================

/**
 * !dungeons - List available dungeons
 */
async function handleDungeonsListCommand(username) {
  const { DUNGEON_REQUIREMENTS } = await import('../data/queueRequirements.js');
  
  const dungeons = Object.values(DUNGEON_REQUIREMENTS);
  
  let message = `📜 Available Dungeons:\n`;
  dungeons.forEach((dungeon, index) => {
    message += `${index + 1}. ${dungeon.name} (Lv${dungeon.minLevel}-${dungeon.maxLevel}, GS ${dungeon.minGearScore}+) - ${dungeon.totalPlayers} players\n`;
  });
  message += `\nStreamer: Use !dungeon [number] to create a queue!`;
  
  return {
    success: true,
    message: `@${username} ${message}`
  };
}

/**
 * !raids - List available raids
 */
async function handleRaidsListCommand(username) {
  const { RAID_REQUIREMENTS } = await import('../data/queueRequirements.js');
  
  const raids = Object.values(RAID_REQUIREMENTS);
  
  let message = `📜 Available Raids:\n`;
  raids.forEach((raid, index) => {
    message += `${index + 1}. ${raid.name} (Lv${raid.minLevel}+, GS ${raid.minGearScore}+) - ${raid.totalPlayers} players\n`;
  });
  message += `\nStreamer: Use !raid [number] to create a queue!`;
  
  return {
    success: true,
    message: `@${username} ${message}`
  };
}

/**
 * !dungeon [number] - Create dungeon queue (streamer only)
 */
async function handleDungeonQueueCommand(args, username, userId, streamerUsername, battlefieldId) {
  const { DUNGEON_REQUIREMENTS } = await import('../data/queueRequirements.js');
  const { createQueue } = await import('./queueService.js');
  
  console.log(`[Queue Command] !dungeon called by ${username} (userId: ${userId})`);
  console.log(`[Queue Command] BattlefieldId: ${battlefieldId}`);
  
  // Get dungeon number
  const dungeonNumber = parseInt(args[0], 10);
  
  if (isNaN(dungeonNumber) || dungeonNumber < 1 || dungeonNumber > Object.keys(DUNGEON_REQUIREMENTS).length) {
    return {
      success: false,
      message: `@${username} Invalid dungeon number! Use !dungeons to see available dungeons.`
    };
  }
  
  // Get dungeon by index
  const dungeonKeys = Object.keys(DUNGEON_REQUIREMENTS);
  const dungeonId = dungeonKeys[dungeonNumber - 1];
  
  console.log(`[Queue Command] Creating queue for dungeon: ${dungeonId}`);
  
  // Create queue
  const result = await createQueue(battlefieldId, userId, streamerUsername, 'dungeon', dungeonId);
  
  if (!result.success) {
    return result;
  }
  
  const queue = result.queue;
  
  // AUTO-JOIN: Add streamer's hero to the queue automatically
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', userId)
    .where('currentBattlefieldId', '==', battlefieldId)
    .limit(1)
    .get();
  
  if (!heroesSnapshot.empty) {
    const heroDoc = heroesSnapshot.docs[0];
    const hero = { id: heroDoc.id, ...heroDoc.data() };
    
    console.log(`[Queue] Auto-joining streamer ${username} to their own queue...`);
    
    const { joinQueue } = await import('./queueService.js');
    const joinResult = await joinQueue(queue.code, hero, username, userId);
    
    if (joinResult.success) {
      console.log(`[Queue] ✅ Streamer auto-joined successfully`);
    } else {
      console.warn(`[Queue] ⚠️ Streamer couldn't auto-join:`, joinResult.message);
    }
  } else {
    console.warn(`[Queue] ⚠️ Streamer has no active hero to auto-join`);
  }
  
  // Broadcast queue creation
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(userId, {
    type: 'queue_created',
    queue
  });
  
  const publicMessage = `🏰 ${username} created a ${queue.name} queue!
🎯 Requirements: Lv${queue.requirements.minLevel}-${queue.requirements.maxLevel}, Gear Score ${queue.requirements.minGearScore}+
👥 Roles: ${queue.requirements.roles.tank.required} Tank, ${queue.requirements.roles.healer.required} Healer, ${queue.requirements.roles.dps.required} DPS
⏰ Expires in 30 minutes

📋 Check the Player Portal for the room code!
Type !qdungeon [CODE] to join!`;
  
  return {
    success: true,
    message: publicMessage,
    queue
  };
}

/**
 * !raid [number] - Create raid queue (streamer only)
 */
async function handleRaidQueueCommand(args, username, userId, streamerUsername, battlefieldId) {
  const { RAID_REQUIREMENTS } = await import('../data/queueRequirements.js');
  const { createQueue } = await import('./queueService.js');
  
  // Get raid number
  const raidNumber = parseInt(args[0], 10);
  
  if (isNaN(raidNumber) || raidNumber < 1 || raidNumber > Object.keys(RAID_REQUIREMENTS).length) {
    return {
      success: false,
      message: `@${username} Invalid raid number! Use !raids to see available raids.`
    };
  }
  
  // Get raid by index
  const raidKeys = Object.keys(RAID_REQUIREMENTS);
  const raidId = raidKeys[raidNumber - 1];
  
  // Create queue
  const result = await createQueue(battlefieldId, userId, streamerUsername, 'raid', raidId);
  
  if (!result.success) {
    return result;
  }
  
  const queue = result.queue;
  
  // AUTO-JOIN: Add streamer's hero to the queue automatically
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', userId)
    .where('currentBattlefieldId', '==', battlefieldId)
    .limit(1)
    .get();
  
  if (!heroesSnapshot.empty) {
    const heroDoc = heroesSnapshot.docs[0];
    const hero = { id: heroDoc.id, ...heroDoc.data() };
    
    console.log(`[Queue] Auto-joining streamer ${username} to their own raid queue...`);
    
    const { joinQueue } = await import('./queueService.js');
    const joinResult = await joinQueue(queue.code, hero, username, userId);
    
    if (joinResult.success) {
      console.log(`[Queue] ✅ Streamer auto-joined successfully`);
    } else {
      console.warn(`[Queue] ⚠️ Streamer couldn't auto-join:`, joinResult.message);
    }
  } else {
    console.warn(`[Queue] ⚠️ Streamer has no active hero to auto-join`);
  }
  
  // Broadcast queue creation
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(userId, {
    type: 'queue_created',
    queue
  });
  
  const publicMessage = `🐉 ${username} created a ${queue.name} queue!
🎯 Requirements: Lv${queue.requirements.minLevel}+, Gear Score ${queue.requirements.minGearScore}+
👥 Roles: ${queue.requirements.roles.tank.required} Tanks, ${queue.requirements.roles.healer.required} Healers, ${queue.requirements.roles.dps.required} DPS
⚠️ Minimum ${queue.requirements.minHealers} healer${queue.requirements.minHealers > 1 ? 's' : ''} required!
⏰ Expires in 30 minutes

📋 Check the Player Portal for the room code!
Type !qraid [CODE] to join!`;
  
  return {
    success: true,
    message: publicMessage,
    queue
  };
}

/**
 * !qdungeon [code] - Join dungeon queue
 */
async function handleQDungeonJoinCommand(args, hero, username, userId, battlefieldId) {
  const { joinQueue } = await import('./queueService.js');
  
  if (!args[0]) {
    return {
      success: false,
      message: `@${username} Please provide the room code! Example: !qdungeon HERO`
    };
  }
  
  const code = args[0].toUpperCase();
  
  // Join queue
  const result = await joinQueue(code, hero, username, userId);
  
  if (!result.success) {
    return result;
  }
  
  // Broadcast queue update
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(result.queue.streamerId, {
    type: 'queue_updated',
    queue: result.queue
  });
  
  // If ready, schedule auto-launch
  if (result.isReady) {
    setTimeout(async () => {
      const { launchInstance, getActiveQueue } = await import('./queueService.js');
      
      // Check if queue still exists and is ready
      const currentQueue = await getActiveQueue(result.queue.battlefieldId);
      if (currentQueue && currentQueue.isReady) {
        const launchResult = await launchInstance(result.queue.battlefieldId, currentQueue);
        
        if (launchResult.success) {
          broadcastToRoom(currentQueue.streamerId, {
            type: 'instance_launched',
            instanceId: launchResult.instanceId,
            instance: launchResult.instance
          });
        }
      }
    }, 10000); // 10 second countdown
  }
  
  return result;
}

/**
 * !qraid [code] - Join raid queue
 */
async function handleQRaidJoinCommand(args, hero, username, userId, battlefieldId) {
  const { joinQueue } = await import('./queueService.js');
  
  if (!args[0]) {
    return {
      success: false,
      message: `@${username} Please provide the room code! Example: !qraid DRAG`
    };
  }
  
  const code = args[0].toUpperCase();
  
  // Join queue
  const result = await joinQueue(code, hero, username, userId);
  
  if (!result.success) {
    return result;
  }
  
  // Broadcast queue update
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(result.queue.streamerId, {
    type: 'queue_updated',
    queue: result.queue
  });
  
  // If ready, schedule auto-launch
  if (result.isReady) {
    setTimeout(async () => {
      const { launchInstance, getActiveQueue } = await import('./queueService.js');
      
      const currentQueue = await getActiveQueue(result.queue.battlefieldId);
      if (currentQueue && currentQueue.isReady) {
        const launchResult = await launchInstance(result.queue.battlefieldId, currentQueue);
        
        if (launchResult.success) {
          broadcastToRoom(currentQueue.streamerId, {
            type: 'instance_launched',
            instanceId: launchResult.instanceId,
            instance: launchResult.instance
          });
        }
      }
    }, 10000);
  }
  
  return result;
}

/**
 * !qstatus - Show queue status
 */
async function handleQStatusCommand(battlefieldId, username) {
  const { getActiveQueue } = await import('./queueService.js');
  const { formatQueueStatus, getNeededRoles } = await import('../data/queueRequirements.js');
  
  const queue = await getActiveQueue(battlefieldId);
  
  if (!queue) {
    return {
      success: false,
      message: `@${username} No active queue! Streamer can create one with !dungeon [number] or !raid [number]`
    };
  }
  
  const statusStr = formatQueueStatus(queue);
  const needed = getNeededRoles(queue);
  
  let message = `📋 Queue ${queue.code} (${queue.name}):\n${statusStr}`;
  
  if (queue.participants.length > 0) {
    message += `\n\nParty: ${queue.participants.map(p => `${p.username} (${p.role.toUpperCase()})`).join(', ')}`;
  }
  
  if (needed.length > 0) {
    message += `\n\nStill needed: ${needed.join(', ')}`;
    message += `\n\nType !q${queue.type} ${queue.code} to join!`;
  } else {
    message += `\n\n🎉 Group is ready! Launching soon...`;
  }
  
  return {
    success: true,
    message: `@${username} ${message}`
  };
}

/**
 * !qstart - Force start queue (streamer only, requires filled roles)
 */
async function handleQStartCommand(battlefieldId, username, streamerName) {
  const { getActiveQueue, launchInstance } = await import('./queueService.js');
  const { areRolesFilled, getNeededRoles } = await import('../data/queueRequirements.js');
  
  const queue = await getActiveQueue(battlefieldId);
  
  if (!queue) {
    return {
      success: false,
      message: `@${username} No active queue to start!`
    };
  }
  
  // Validate all required roles are filled
  if (!areRolesFilled(queue)) {
    const needed = getNeededRoles(queue);
    return {
      success: false,
      message: `@${username} Cannot start! Missing required roles: ${needed.join(', ')}`
    };
  }
  
  // Launch instance
  const result = await launchInstance(battlefieldId, queue);
  
  if (!result.success) {
    return result;
  }
  
  // Broadcast launch
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(queue.streamerId, {
    type: 'instance_launched',
    instanceId: result.instanceId,
    instance: result.instance
  });
  
  return {
    success: true,
    message: `⚡ ${username} is force-starting ${queue.name}! Launching NOW! ⚔️`
  };
}

/**
 * !qcancel - Cancel queue (streamer only)
 */
async function handleQCancelCommand(battlefieldId, username) {
  const { cancelQueue } = await import('./queueService.js');
  
  const result = await cancelQueue(battlefieldId);
  
  if (!result.success) {
    return result;
  }
  
  // Broadcast cancellation
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(result.queue.streamerId, {
    type: 'queue_cancelled',
    queue: result.queue
  });
  
  return {
    success: true,
    message: `@${username} ${result.message}`
  };
}

/**
 * !qleave - Leave queue
 */
async function handleQLeaveCommand(userId, username) {
  const { leaveQueue } = await import('./queueService.js');
  
  const result = await leaveQueue(userId, username);
  
  if (!result.success) {
    return result;
  }
  
  // Broadcast queue update
  const { broadcastToRoom } = await import('../websocket/server.js');
  broadcastToRoom(result.queue.streamerId, {
    type: 'queue_updated',
    queue: result.queue
  });
  
  return result;
}
