/**
 * Queue Service - Manages dungeon and raid queues
 */

import admin from 'firebase-admin';
import { db } from '../index.js';
import {
  DUNGEON_REQUIREMENTS,
  RAID_REQUIREMENTS,
  getHeroRole,
  calculateGearScore,
  generateQueueCode,
  getTotalRequired,
  areRolesFilled,
  formatQueueStatus,
  getNeededRoles
} from '../data/queueRequirements.js';

/**
 * Get active queue for a battlefield
 */
export async function getActiveQueue(battlefieldId) {
  const queueDoc = await db.collection('battlefieldQueues').doc(battlefieldId).get();
  
  if (!queueDoc.exists) {
    return null;
  }
  
  const queue = queueDoc.data();
  
  // Check if expired
  if (queue.expiresAt.toMillis() < Date.now()) {
    // Delete expired queue
    await queueDoc.ref.delete();
    return null;
  }
  
  return { ...queue, id: queueDoc.id };
}

/**
 * Create a new queue
 */
export async function createQueue(battlefieldId, streamerId, streamerName, type, instanceId) {
  // Check for existing queue
  const existing = await getActiveQueue(battlefieldId);
  if (existing) {
    return {
      success: false,
      message: `Already have an active queue: ${existing.name} (code: ${existing.code}, ${existing.participants.length}/${existing.totalPlayers} players). Use !qcancel to cancel it first.`,
      existingQueue: existing
    };
  }
  
  // Get requirements
  const requirements = type === 'dungeon' 
    ? DUNGEON_REQUIREMENTS[instanceId]
    : RAID_REQUIREMENTS[instanceId];
  
  if (!requirements) {
    return {
      success: false,
      message: `Invalid ${type} ID: ${instanceId}`
    };
  }
  
  // Generate code
  const code = generateQueueCode(type, instanceId);
  
  // Create queue
  const queue = {
    queueId: `${type}_${instanceId}_${Date.now()}`,
    streamerId,
    streamerName,
    battlefieldId,
    
    code,
    
    type,
    instanceId,
    name: requirements.name,
    description: requirements.description,
    
    requirements: {
      minLevel: requirements.minLevel,
      maxLevel: requirements.maxLevel,
      minGearScore: requirements.minGearScore,
      recommendedGearScore: requirements.recommendedGearScore,
      minHealers: requirements.minHealers || null,
      roles: {
        tank: { current: 0, required: requirements.roles.tank.required, filled: false },
        healer: { current: 0, required: requirements.roles.healer.required, filled: false },
        dps: { current: 0, required: requirements.roles.dps.required, filled: false }
      }
    },
    
    participants: [],
    
    status: 'open',
    isReady: false,
    totalPlayers: requirements.totalPlayers,
    
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)), // 30 min
    launchAt: null
  };
  
  // Save to Firebase
  console.log('═══════════════════════════════════════════════');
  console.log('[Queue] 📝 SAVING QUEUE TO FIREBASE');
  console.log('[Queue] Collection: battlefieldQueues');
  console.log('[Queue] Document ID:', battlefieldId);
  console.log('[Queue] Code:', code);
  console.log('[Queue] StreamerId:', streamerId);
  console.log('[Queue] Full queue object:', JSON.stringify(queue, null, 2));
  console.log('═══════════════════════════════════════════════');
  
  await db.collection('battlefieldQueues').doc(battlefieldId).set(queue);
  
  console.log(`[Queue] ✅ Queue saved successfully to battlefieldQueues/${battlefieldId}`);
  
  return {
    success: true,
    queue,
    message: `🏰 ${requirements.name} queue created! Room Code: ${code}`
  };
}

/**
 * Add player to queue
 */
export async function joinQueue(code, hero, viewerUsername, viewerId) {
  // Validate code
  const queuesSnapshot = await db.collection('battlefieldQueues')
    .where('code', '==', code.toUpperCase())
    .where('status', '==', 'open')
    .limit(1)
    .get();
  
  if (queuesSnapshot.empty) {
    return {
      success: false,
      message: `@${viewerUsername} Invalid or expired queue code: ${code.toUpperCase()}`
    };
  }
  
  const queueDoc = queuesSnapshot.docs[0];
  const queue = queueDoc.data();
  
  // Check if already in queue
  if (queue.participants.some(p => p.userId === viewerId)) {
    return {
      success: false,
      message: `@${viewerUsername} You're already in queue ${code.toUpperCase()}!`
    };
  }
  
  // Validate level (only check minimum - over-leveled heroes can join!)
  if (hero.level < queue.requirements.minLevel) {
    return {
      success: false,
      message: `@${viewerUsername} Your hero is Lv${hero.level}, but ${queue.name} requires Lv${queue.requirements.minLevel}+!`
    };
  }
  
  // Validate gear score
  const gearScore = calculateGearScore(hero);
  if (gearScore < queue.requirements.minGearScore) {
    return {
      success: false,
      message: `@${viewerUsername} Your gear score is ${gearScore}, but ${queue.name} requires ${queue.requirements.minGearScore}+! Equip better gear!`
    };
  }
  
  // Detect role
  const heroRole = getHeroRole(hero.role);
  
  // Check if role slot available
  const roleReq = queue.requirements.roles[heroRole];
  if (roleReq.current >= roleReq.required) {
    const needed = getNeededRoles(queue);
    
    return {
      success: false,
      message: `@${viewerUsername} ${heroRole.toUpperCase()} slots are full! (${roleReq.current}/${roleReq.required} ✅) ${needed.length > 0 ? `Still needed: ${needed.join(', ')}` : ''}`
    };
  }
  
  // Add participant
  const participant = {
    userId: viewerId,
    heroId: hero.id,
    username: viewerUsername,
    heroName: hero.name || viewerUsername,
    role: heroRole,
    class: hero.role,
    level: hero.level,
    gearScore,
    joinedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  
  queue.participants.push(participant);
  queue.requirements.roles[heroRole].current++;
  queue.requirements.roles[heroRole].filled = 
    queue.requirements.roles[heroRole].current >= queue.requirements.roles[heroRole].required;
  
  // Check if ready
  queue.isReady = areRolesFilled(queue);
  
  // Set launch timer if ready
  if (queue.isReady) {
    queue.launchAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + 10000)); // 10s
    queue.status = 'ready';
  }
  
  // Save to Firebase
  await queueDoc.ref.update(queue);
  
  // Format response
  const statusStr = formatQueueStatus(queue);
  let message = `✅ ${viewerUsername} (${hero.role.charAt(0).toUpperCase() + hero.role.slice(1)} ${heroRole.toUpperCase()} Lv${hero.level}, GS ${gearScore}) joined ${code.toUpperCase()}!\n${statusStr}`;
  
  if (queue.isReady) {
    message += `\n\n🎉 GROUP IS READY! All roles filled!\n🏰 ${queue.name} launching in 10 seconds... ⚔️`;
  } else {
    const needed = getNeededRoles(queue);
    if (needed.length > 0) {
      message += `\nStill needed: ${needed.join(', ')}`;
    }
  }
  
  return {
    success: true,
    queue,
    message,
    isReady: queue.isReady
  };
}

/**
 * Remove player from queue
 */
export async function leaveQueue(viewerId, viewerUsername) {
  // Find queue containing this player
  const queuesSnapshot = await db.collection('battlefieldQueues')
    .where('status', '==', 'open')
    .get();
  
  let foundQueue = null;
  let queueDoc = null;
  
  for (const doc of queuesSnapshot.docs) {
    const queue = doc.data();
    if (queue.participants.some(p => p.userId === viewerId)) {
      foundQueue = queue;
      queueDoc = doc;
      break;
    }
  }
  
  if (!foundQueue) {
    return {
      success: false,
      message: `@${viewerUsername} You're not in any active queue!`
    };
  }
  
  // Remove participant
  const participant = foundQueue.participants.find(p => p.userId === viewerId);
  foundQueue.participants = foundQueue.participants.filter(p => p.userId !== viewerId);
  
  // Update role counts
  if (participant) {
    const role = participant.role;
    foundQueue.requirements.roles[role].current--;
    foundQueue.requirements.roles[role].filled = 
      foundQueue.requirements.roles[role].current >= foundQueue.requirements.roles[role].required;
  }
  
  // No longer ready if someone left
  foundQueue.isReady = false;
  foundQueue.status = 'open';
  foundQueue.launchAt = null;
  
  // Save
  await queueDoc.ref.update(foundQueue);
  
  const statusStr = formatQueueStatus(foundQueue);
  
  return {
    success: true,
    queue: foundQueue,
    message: `${viewerUsername} left the queue ${foundQueue.code}.\n${statusStr}`
  };
}

/**
 * Cancel queue (streamer only)
 */
export async function cancelQueue(battlefieldId) {
  const queue = await getActiveQueue(battlefieldId);
  
  if (!queue) {
    return {
      success: false,
      message: 'No active queue to cancel!'
    };
  }
  
  // Delete queue
  await db.collection('battlefieldQueues').doc(battlefieldId).delete();
  
  return {
    success: true,
    message: `❌ ${queue.name} queue (code: ${queue.code}) has been cancelled!`,
    queue
  };
}

/**
 * Launch dungeon/raid instance
 */
export async function launchInstance(battlefieldId, queue) {
  console.log(`[Queue] Launching ${queue.type} instance:`, queue.name);
  
  // Create instance ID
  const instanceId = `${queue.type}_${queue.instanceId}_${Date.now()}`;
  
  const instance = {
    id: instanceId,
    type: queue.type,
    instanceType: queue.instanceId,
    difficulty: queue.instanceId,
    name: queue.name,
    
    participants: queue.participants,
    
    status: 'in_progress',
    currentRoom: 0,
    totalRooms: queue.type === 'dungeon' ? 5 : 10,
    
    createdBy: queue.streamerId,
    battlefieldId: queue.battlefieldId,
    
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000)) // 2 hours
  };
  
  // Save instance
  const collectionName = queue.type === 'dungeon' ? 'dungeonInstances' : 'raidInstances';
  await db.collection(collectionName).doc(instanceId).set(instance);
  
  // Update all participants' hero locations
  const batch = db.batch();
  queue.participants.forEach(p => {
    const heroRef = db.collection('heroes').doc(p.heroId);
    batch.update(heroRef, {
      currentInstanceId: instanceId,
      currentInstanceType: queue.type,
      currentBattlefieldId: admin.firestore.FieldValue.delete(), // Leave battlefield
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  await batch.commit();
  
  // Delete queue
  await db.collection('battlefieldQueues').doc(battlefieldId).delete();
  
  console.log(`[Queue] ✅ Launched ${queue.type} ${instanceId} with ${queue.participants.length} participants`);
  
  return {
    success: true,
    instanceId,
    instance,
    message: `⚔️ ${queue.name} started! Good luck heroes! 🗡️`
  };
}
