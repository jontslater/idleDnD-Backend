/**
 * Queue Service - battlefield dungeon/raid queues (chat + portal)
 */

import admin from 'firebase-admin';
import { db } from '../index.js';
import {
  DUNGEON_REQUIREMENTS,
  RAID_REQUIREMENTS,
  getHeroRole,
  calculateGearScore,
  generateQueueCode,
  areRolesFilled,
  formatQueueStatus,
  getNeededRoles
} from '../data/queueRequirements.js';
import { resolveQueueContentId } from '../data/queueKeyMapping.js';
import { getDungeonById } from '../data/dungeons.js';
import { getRaidById } from '../data/raids.js';
import { INSTANCE_STATUS, QUEUE_STATUS } from '../constants/instanceStatus.js';

const LAUNCH_COUNTDOWN_MS = 10000;

function timestampToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  if (typeof ts._seconds === 'number') return ts._seconds * 1000;
  return null;
}

function isQueueExpired(queue) {
  const expiresMs = timestampToMillis(queue.expiresAt);
  return expiresMs != null && expiresMs < Date.now();
}

/**
 * Get active queue for a battlefield (open, ready, or launching).
 */
export async function getActiveQueue(battlefieldId) {
  const queueDoc = await db.collection('battlefieldQueues').doc(battlefieldId).get();

  if (!queueDoc.exists) {
    return null;
  }

  const queue = queueDoc.data();

  if (isQueueExpired(queue)) {
    await queueDoc.ref.delete();
    return null;
  }

  if (queue.status === QUEUE_STATUS.LAUNCHING) {
    return { ...queue, id: queueDoc.id };
  }

  return { ...queue, id: queueDoc.id };
}

/**
 * Open queue for a streamer twitch id (battlefield doc id is twitch:{twitchId}).
 */
export async function getOpenQueueForStreamer(twitchId) {
  const battlefieldId = `twitch:${twitchId}`;
  return getActiveQueue(battlefieldId);
}

/**
 * Create a new queue (queueKey = normal, heroic, elder_dragon_normal, etc.)
 */
export async function createQueue(battlefieldId, streamerId, streamerName, type, queueKey) {
  const existing = await getActiveQueue(battlefieldId);
  if (existing) {
    return {
      success: false,
      message: `Already have an active queue: ${existing.name} (code: ${existing.code}, ${existing.participants.length}/${existing.totalPlayers} players). Use !qcancel to cancel it first.`,
      existingQueue: existing
    };
  }

  const mapped = resolveQueueContentId(type, queueKey);
  if (!mapped.ok) {
    return {
      success: false,
      message: mapped.message
    };
  }

  const requirements = type === 'dungeon'
    ? DUNGEON_REQUIREMENTS[queueKey]
    : RAID_REQUIREMENTS[queueKey];

  if (!requirements) {
    return {
      success: false,
      message: `Invalid ${type} queue key: ${queueKey}`
    };
  }

  const code = generateQueueCode(type, queueKey);

  const queue = {
    queueId: `${type}_${queueKey}_${Date.now()}`,
    streamerId,
    streamerName,
    battlefieldId,

    code,

    type,
    queueKey,
    contentId: mapped.contentId,
    instanceId: queueKey,
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

    status: QUEUE_STATUS.OPEN,
    isReady: false,
    totalPlayers: requirements.totalPlayers,

    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 60 * 1000)),
    launchAt: null
  };

  await db.collection('battlefieldQueues').doc(battlefieldId).set(queue);

  return {
    success: true,
    queue,
    message: `🏰 ${requirements.name} queue created! Room Code: ${code}`
  };
}

async function ensureHeroOnBattlefield(heroId, battlefieldId) {
  const heroRef = db.collection('heroes').doc(heroId);
  const heroDoc = await heroRef.get();
  if (!heroDoc.exists) {
    return { ok: false, message: 'Hero not found' };
  }
  const hero = heroDoc.data();
  if (hero.currentBattlefieldId && hero.currentBattlefieldId !== battlefieldId) {
    await heroRef.update({
      currentBattlefieldId: battlefieldId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else if (!hero.currentBattlefieldId) {
    await heroRef.update({
      currentBattlefieldId: battlefieldId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  return { ok: true };
}

/**
 * Add player to queue
 * @param {object} [options]
 * @param {'dungeon'|'raid'} [options.expectedType]
 * @param {string} [options.expectedBattlefieldId]
 */
export async function joinQueue(code, hero, viewerUsername, viewerId, options = {}) {
  const queuesSnapshot = await db.collection('battlefieldQueues')
    .where('code', '==', code.toUpperCase())
    .where('status', '==', QUEUE_STATUS.OPEN)
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

  if (options.expectedType && queue.type !== options.expectedType) {
    return {
      success: false,
      message: `@${viewerUsername} That code is for a ${queue.type} queue. Use !q${queue.type} ${code.toUpperCase()} instead.`
    };
  }

  if (options.expectedBattlefieldId && queue.battlefieldId !== options.expectedBattlefieldId) {
    return {
      success: false,
      message: `@${viewerUsername} You can only join this queue from ${queue.streamerName}'s channel.`
    };
  }

  if (queue.participants.some(p => p.userId === viewerId)) {
    return {
      success: false,
      message: `@${viewerUsername} You're already in queue ${code.toUpperCase()}!`
    };
  }

  if (hero.level < queue.requirements.minLevel) {
    return {
      success: false,
      message: `@${viewerUsername} Your hero is Lv${hero.level}, but ${queue.name} requires Lv${queue.requirements.minLevel}+!`
    };
  }

  const gearScore = calculateGearScore(hero);
  if (gearScore < queue.requirements.minGearScore) {
    return {
      success: false,
      message: `@${viewerUsername} Your gear score is ${gearScore}, but ${queue.name} requires ${queue.requirements.minGearScore}+! Equip better gear!`
    };
  }

  const heroRole = getHeroRole(hero.role);
  const roleReq = queue.requirements.roles[heroRole];
  if (roleReq.current >= roleReq.required) {
    const needed = getNeededRoles(queue);
    return {
      success: false,
      message: `@${viewerUsername} ${heroRole.toUpperCase()} slots are full! (${roleReq.current}/${roleReq.required} ✅) ${needed.length > 0 ? `Still needed: ${needed.join(', ')}` : ''}`
    };
  }

  const onBf = await ensureHeroOnBattlefield(hero.id, queue.battlefieldId);
  if (!onBf.ok) {
    return { success: false, message: `@${viewerUsername} ${onBf.message}` };
  }

  const participant = {
    userId: viewerId,
    twitchUserId: hero.twitchUserId || viewerId,
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

  queue.isReady = areRolesFilled(queue);

  if (queue.isReady) {
    queue.launchAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + LAUNCH_COUNTDOWN_MS));
    queue.status = QUEUE_STATUS.READY;
  }

  await queueDoc.ref.update({
    participants: queue.participants,
    requirements: queue.requirements,
    isReady: queue.isReady,
    status: queue.status,
    launchAt: queue.launchAt ?? null
  });

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
 * Remove player from queue (open or countdown/ready).
 */
export async function leaveQueue(viewerId, viewerUsername) {
  const openSnap = await db.collection('battlefieldQueues')
    .where('status', '==', QUEUE_STATUS.OPEN)
    .get();
  const readySnap = await db.collection('battlefieldQueues')
    .where('status', '==', QUEUE_STATUS.READY)
    .get();

  const allDocs = [...openSnap.docs, ...readySnap.docs];

  let foundQueue = null;
  let queueDoc = null;

  for (const doc of allDocs) {
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

  const participant = foundQueue.participants.find(p => p.userId === viewerId);
  foundQueue.participants = foundQueue.participants.filter(p => p.userId !== viewerId);

  if (participant) {
    const role = participant.role;
    foundQueue.requirements.roles[role].current--;
    foundQueue.requirements.roles[role].filled =
      foundQueue.requirements.roles[role].current >= foundQueue.requirements.roles[role].required;
  }

  foundQueue.isReady = false;
  foundQueue.status = QUEUE_STATUS.OPEN;
  foundQueue.launchAt = null;

  await queueDoc.ref.update({
    participants: foundQueue.participants,
    requirements: foundQueue.requirements,
    isReady: foundQueue.isReady,
    status: foundQueue.status,
    launchAt: null
  });

  const statusStr = formatQueueStatus(foundQueue);

  return {
    success: true,
    queue: foundQueue,
    message: `${viewerUsername} left the queue ${foundQueue.code}.\n${statusStr}`,
    cancelledLaunch: true
  };
}

export async function cancelQueue(battlefieldId) {
  const queue = await getActiveQueue(battlefieldId);

  if (!queue) {
    return {
      success: false,
      message: 'No active queue to cancel!'
    };
  }

  await db.collection('battlefieldQueues').doc(battlefieldId).delete();

  return {
    success: true,
    message: `❌ ${queue.name} queue (code: ${queue.code}) has been cancelled!`,
    queue
  };
}

async function loadParticipantRows(queue) {
  const participantData = [];
  for (const p of queue.participants) {
    const heroDoc = await db.collection('heroes').doc(p.heroId).get();
    if (!heroDoc.exists) {
      continue;
    }
    const hero = heroDoc.data();
    const twitchUserId = hero.twitchUserId || p.twitchUserId || p.userId;
    participantData.push({
      userId: p.heroId,
      heroId: p.heroId,
      twitchUserId,
      username: p.username || hero.name || p.heroId,
      heroName: p.heroName || hero.name,
      heroRole: hero.role,
      heroLevel: p.level || hero.level || 1,
      currentHp: hero.hp || hero.maxHp || 100,
      maxHp: hero.maxHp || 100,
      isAlive: true,
      deaths: 0,
      role: p.role
    });
  }
  return participantData;
}

/**
 * Claim queue for launch (prevents double launch).
 */
async function claimQueueForLaunch(battlefieldId) {
  const ref = db.collection('battlefieldQueues').doc(battlefieldId);

  if (typeof db.runTransaction === 'function') {
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        return { claimed: false };
      }
      const queue = snap.data();
      if (queue.status !== QUEUE_STATUS.READY || !queue.isReady) {
        return { claimed: false };
      }
      const launchMs = timestampToMillis(queue.launchAt);
      if (launchMs == null || launchMs > Date.now()) {
        return { claimed: false };
      }
      tx.update(ref, { status: QUEUE_STATUS.LAUNCHING });
      return { claimed: true, queue };
    });
  }

  const snap = await ref.get();
  if (!snap.exists) {
    return { claimed: false };
  }
  const queue = snap.data();
  if (queue.status !== QUEUE_STATUS.READY || !queue.isReady) {
    return { claimed: false };
  }
  const launchMs = timestampToMillis(queue.launchAt);
  if (launchMs == null || launchMs > Date.now()) {
    return { claimed: false };
  }
  await ref.update({ status: QUEUE_STATUS.LAUNCHING });
  return { claimed: true, queue };
}

/**
 * Launch dungeon/raid instance (correct shape for overlay + streamer-key checks).
 */
export async function launchInstance(battlefieldId, queue) {
  console.log(`[Queue] Launching ${queue.type} instance:`, queue.name);

  const contentId = queue.contentId || resolveQueueContentId(queue.type, queue.queueKey || queue.instanceId)?.contentId;
  if (!contentId) {
    return { success: false, message: 'Invalid queue content mapping' };
  }

  const participantData = await loadParticipantRows(queue);
  const participantIds = participantData.map(p => p.twitchUserId).filter(Boolean);
  const organizerId = queue.streamerId;

  let instanceRef;
  let instancePayload;

  if (queue.type === 'dungeon') {
    const dungeonData = getDungeonById(contentId);
    if (!dungeonData) {
      return { success: false, message: `Dungeon not found: ${contentId}` };
    }

    instancePayload = {
      dungeonId: dungeonData.id,
      difficulty: dungeonData.difficulty || 'normal',
      status: INSTANCE_STATUS.IN_PROGRESS,
      organizerId,
      participants: participantData,
      participantIds,
      currentRoom: 0,
      maxRooms: dungeonData.rooms.length,
      rooms: dungeonData.rooms,
      combatLog: [],
      battlefieldId: queue.battlefieldId,
      streamerId: queue.streamerId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    instanceRef = await db.collection('dungeonInstances').add(instancePayload);
  } else {
    const raidData = getRaidById(contentId);
    if (!raidData) {
      return { success: false, message: `Raid not found: ${contentId}` };
    }

    instancePayload = {
      raidId: raidData.id,
      difficulty: raidData.difficulty,
      status: INSTANCE_STATUS.IN_PROGRESS,
      organizerId,
      currentWave: 0,
      maxWaves: raidData.waves,
      bossHp: raidData.boss.hp,
      bossMaxHp: raidData.boss.hp,
      participants: participantData.map(p => ({
        ...p,
        damageDealt: 0,
        healingDone: 0,
        damageTaken: 0,
        itemScore: 0
      })),
      participantIds,
      combatLog: [{
        timestamp: Date.now(),
        message: `Raid started: ${raidData.name}`,
        type: 'phase'
      }],
      lootDrops: [],
      battlefieldId: queue.battlefieldId,
      streamerId: queue.streamerId,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    instanceRef = await db.collection('raidInstances').add(instancePayload);
  }

  const instanceId = instanceRef.id;

  const batch = db.batch();
  for (const p of participantData) {
    const heroRef = db.collection('heroes').doc(p.heroId);
    batch.update(heroRef, {
      currentBattlefieldId: queue.battlefieldId,
      activeInstance: {
        type: queue.type,
        instanceId
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();

  await db.collection('battlefieldQueues').doc(battlefieldId).delete();

  console.log(`[Queue] ✅ Launched ${queue.type} ${instanceId} with ${participantData.length} participants`);

  return {
    success: true,
    instanceId,
    instance: { id: instanceId, ...instancePayload },
    message: `⚔️ ${queue.name} started! Good luck heroes! 🗡️`
  };
}

/**
 * Try to launch a single battlefield queue if due.
 */
export async function tryLaunchDueQueue(battlefieldId) {
  const claim = await claimQueueForLaunch(battlefieldId);
  if (!claim.claimed || !claim.queue) {
    return { launched: false };
  }
  const result = await launchInstance(battlefieldId, claim.queue);
  return { launched: result.success, result };
}

/**
 * Sweep all ready queues past launchAt (boot + interval).
 */
export async function sweepDueQueues() {
  const readySnap = await db.collection('battlefieldQueues')
    .where('status', '==', QUEUE_STATUS.READY)
    .get();

  const launched = [];
  for (const doc of readySnap.docs) {
    const queue = doc.data();
    const launchMs = timestampToMillis(queue.launchAt);
    if (launchMs == null || launchMs > Date.now()) {
      continue;
    }
    if (!queue.isReady || !areRolesFilled(queue)) {
      continue;
    }
    const outcome = await tryLaunchDueQueue(doc.id);
    if (outcome.launched) {
      launched.push({ battlefieldId: doc.id, ...outcome });
    }
  }
  return launched;
}

export async function joinQueueByBattlefieldDocId(queueDocId, hero, userId, options = {}) {
  const queueDoc = await db.collection('battlefieldQueues').doc(queueDocId).get();
  if (!queueDoc.exists) {
    return { success: false, message: 'Queue not found' };
  }
  const queue = queueDoc.data();
  return joinQueue(queue.code, hero, hero.name || userId, userId, {
    expectedType: options.expectedType,
    expectedBattlefieldId: options.expectedBattlefieldId
  });
}
