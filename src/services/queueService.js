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

function removeParticipantFromQueue(queue, viewerId, heroId) {
  const participant = queue.participants.find(
    p => p.userId === viewerId || p.heroId === heroId
  );
  if (!participant) {
    return { queue, removed: false };
  }
  queue.participants = queue.participants.filter(
    p => p.userId !== viewerId && p.heroId !== heroId
  );
  const role = participant.role;
  if (queue.requirements?.roles?.[role]) {
    queue.requirements.roles[role].current--;
    queue.requirements.roles[role].filled =
      queue.requirements.roles[role].current >= queue.requirements.roles[role].required;
  }
  queue.isReady = areRolesFilled(queue);
  queue.status = queue.isReady ? QUEUE_STATUS.READY : QUEUE_STATUS.OPEN;
  queue.launchAt = queue.isReady
    ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + LAUNCH_COUNTDOWN_MS))
    : null;
  return { queue, removed: true };
}

/**
 * Resolve battlefieldQueues doc by Firestore doc id or stored queueId field.
 */
export async function resolveQueueDocument(queueIdParam) {
  if (!queueIdParam) return null;
  const direct = await db.collection('battlefieldQueues').doc(queueIdParam).get();
  if (direct.exists) {
    return direct;
  }
  const byField = await db.collection('battlefieldQueues')
    .where('queueId', '==', queueIdParam)
    .limit(1)
    .get();
  if (!byField.empty) {
    return byField.docs[0];
  }
  return null;
}

/**
 * Active queue for UI/commands — excludes launching (in-flight) queues.
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
    return null;
  }

  return { ...queue, id: queueDoc.id };
}

export async function getOpenQueueForStreamer(twitchId) {
  const battlefieldId = `twitch:${twitchId}`;
  const queue = await getActiveQueue(battlefieldId);
  if (!queue) {
    return null;
  }
  return queue;
}

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
    return { success: false, message: mapped.message };
  }

  const requirements = type === 'dungeon'
    ? DUNGEON_REQUIREMENTS[queueKey]
    : RAID_REQUIREMENTS[queueKey];

  if (!requirements) {
    return { success: false, message: `Invalid ${type} queue key: ${queueKey}` };
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
    queue: { ...queue, id: battlefieldId },
    message: `🏰 ${requirements.name} queue created! Room Code: ${code}`
  };
}

async function findParticipantQueueDocRefs(viewerId, heroId, excludeBattlefieldId = null) {
  const refs = [];
  for (const status of [QUEUE_STATUS.OPEN, QUEUE_STATUS.READY]) {
    const snap = await db.collection('battlefieldQueues').where('status', '==', status).get();
    for (const doc of snap.docs) {
      if (excludeBattlefieldId && doc.id === excludeBattlefieldId) {
        continue;
      }
      const q = doc.data();
      if (q.participants?.some(p => p.userId === viewerId || p.heroId === heroId)) {
        refs.push(doc.ref);
      }
    }
  }
  return refs;
}

async function assertHeroMayJoinQueue(hero, targetBattlefieldId, viewerUsername) {
  if (hero.activeInstance?.instanceId) {
    const type = hero.activeInstance.type === 'raid' ? 'raid' : 'dungeon';
    const coll = type === 'raid' ? 'raidInstances' : 'dungeonInstances';
    const instDoc = await db.collection(coll).doc(hero.activeInstance.instanceId).get();
    if (instDoc.exists) {
      const inst = instDoc.data();
      if (inst.battlefieldId && inst.battlefieldId !== targetBattlefieldId) {
        return {
          ok: false,
          message: `@${viewerUsername} You're in an active ${type} on another stream. Finish it before joining this queue.`
        };
      }
    }
  }

  if (!hero.currentBattlefieldId) {
    return {
      ok: false,
      message: `@${viewerUsername} Use !join on this channel before joining the queue.`
    };
  }

  if (hero.currentBattlefieldId !== targetBattlefieldId) {
    return {
      ok: false,
      message: `@${viewerUsername} You must be on this streamer's channel (!join) before joining the queue.`
    };
  }

  return { ok: true };
}

/**
 * Add player to queue (transactional).
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

  const targetDoc = queuesSnapshot.docs[0];
  const targetRef = targetDoc.ref;
  const preview = targetDoc.data();

  if (options.expectedType && preview.type !== options.expectedType) {
    return {
      success: false,
      message: `@${viewerUsername} That code is for a ${preview.type} queue. Use !q${preview.type} ${code.toUpperCase()} instead.`
    };
  }

  if (options.expectedBattlefieldId && preview.battlefieldId !== options.expectedBattlefieldId) {
    return {
      success: false,
      message: `@${viewerUsername} You can only join this queue from ${preview.streamerName}'s channel.`
    };
  }

  const mayJoin = await assertHeroMayJoinQueue(hero, preview.battlefieldId, viewerUsername);
  if (!mayJoin.ok) {
    return { success: false, message: mayJoin.message };
  }

  const gearScore = calculateGearScore(hero);
  const heroRole = getHeroRole(hero.role);

  if (hero.level < preview.requirements.minLevel) {
    return {
      success: false,
      message: `@${viewerUsername} Your hero is Lv${hero.level}, but ${preview.name} requires Lv${preview.requirements.minLevel}+!`
    };
  }

  if (gearScore < preview.requirements.minGearScore) {
    return {
      success: false,
      message: `@${viewerUsername} Your gear score is ${gearScore}, but ${preview.name} requires ${preview.requirements.minGearScore}+! Equip better gear!`
    };
  }

  const otherQueueRefs = await findParticipantQueueDocRefs(viewerId, hero.id, targetDoc.id);

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

  const applyJoin = async (tx) => {
    const targetSnap = await tx.get(targetRef);
    if (!targetSnap.exists) {
      return { error: 'queue_gone' };
    }
    const queue = { ...targetSnap.data() };

    if (queue.status === QUEUE_STATUS.LAUNCHING) {
      return { error: 'launching' };
    }
    if (queue.status !== QUEUE_STATUS.OPEN) {
      return { error: 'not_open' };
    }

    if (queue.participants.some(p => p.userId === viewerId || p.heroId === hero.id)) {
      return { error: 'already_in' };
    }

    const roleReq = queue.requirements.roles[heroRole];
    if (roleReq.current >= roleReq.required) {
      return { error: 'role_full', queue };
    }

    for (const otherRef of otherQueueRefs) {
      const otherSnap = await tx.get(otherRef);
      if (!otherSnap.exists) continue;
      const otherQueue = { ...otherSnap.data() };
      if (otherQueue.status === QUEUE_STATUS.LAUNCHING) {
        continue;
      }
      const { queue: updatedOther, removed } = removeParticipantFromQueue(
        otherQueue,
        viewerId,
        hero.id
      );
      if (removed) {
        tx.update(otherRef, {
          participants: updatedOther.participants,
          requirements: updatedOther.requirements,
          isReady: updatedOther.isReady,
          status: updatedOther.status,
          launchAt: updatedOther.launchAt ?? null
        });
      }
    }

    queue.participants = [...queue.participants, participant];
    queue.requirements.roles[heroRole].current++;
    queue.requirements.roles[heroRole].filled =
      queue.requirements.roles[heroRole].current >= queue.requirements.roles[heroRole].required;
    queue.isReady = areRolesFilled(queue);

    if (queue.isReady) {
      queue.launchAt = admin.firestore.Timestamp.fromDate(new Date(Date.now() + LAUNCH_COUNTDOWN_MS));
      queue.status = QUEUE_STATUS.READY;
    }

    tx.update(targetRef, {
      participants: queue.participants,
      requirements: queue.requirements,
      isReady: queue.isReady,
      status: queue.status,
      launchAt: queue.launchAt ?? null
    });

    return { queue: { ...queue, id: targetDoc.id } };
  };

  let txResult;
  if (typeof db.runTransaction === 'function') {
    txResult = await db.runTransaction(applyJoin);
  } else {
    txResult = await applyJoin({
      get: (ref) => ref.get(),
      update: (ref, data) => ref.update(data)
    });
  }

  if (txResult.error === 'queue_gone' || txResult.error === 'not_open') {
    return {
      success: false,
      message: `@${viewerUsername} Invalid or expired queue code: ${code.toUpperCase()}`
    };
  }
  if (txResult.error === 'launching') {
    return {
      success: false,
      message: `@${viewerUsername} This queue is launching — try again in a moment.`
    };
  }
  if (txResult.error === 'already_in') {
    return {
      success: false,
      message: `@${viewerUsername} You're already in queue ${code.toUpperCase()}!`
    };
  }
  if (txResult.error === 'role_full') {
    const needed = getNeededRoles(txResult.queue);
    const roleReq = txResult.queue.requirements.roles[heroRole];
    return {
      success: false,
      message: `@${viewerUsername} ${heroRole.toUpperCase()} slots are full! (${roleReq.current}/${roleReq.required} ✅) ${needed.length > 0 ? `Still needed: ${needed.join(', ')}` : ''}`
    };
  }

  const queue = txResult.queue;
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
 * Leave a specific battlefield queue (transactional). Chat may omit battlefieldId to search.
 */
export async function leaveQueue(viewerId, viewerUsername, battlefieldId = null) {
  let queueRef;
  let queueDocId;

  if (battlefieldId) {
    queueRef = db.collection('battlefieldQueues').doc(battlefieldId);
    queueDocId = battlefieldId;
  } else {
    const openSnap = await db.collection('battlefieldQueues').where('status', '==', QUEUE_STATUS.OPEN).get();
    const readySnap = await db.collection('battlefieldQueues').where('status', '==', QUEUE_STATUS.READY).get();
    for (const doc of [...openSnap.docs, ...readySnap.docs]) {
      const queue = doc.data();
      if (queue.participants?.some(p => p.userId === viewerId)) {
        queueRef = doc.ref;
        queueDocId = doc.id;
        break;
      }
    }
  }

  if (!queueRef) {
    return {
      success: false,
      message: `@${viewerUsername} You're not in any active queue!`
    };
  }

  const applyLeave = async (tx) => {
    const snap = await tx.get(queueRef);
    if (!snap.exists) {
      return { error: 'not_found' };
    }
    const queue = { ...snap.data() };

    if (queue.status === QUEUE_STATUS.LAUNCHING) {
      return { error: 'launching' };
    }

    const { queue: updated, removed } = removeParticipantFromQueue(queue, viewerId, null);
    if (!removed) {
      return { error: 'not_in_queue' };
    }

    updated.status = QUEUE_STATUS.OPEN;
    updated.isReady = false;
    updated.launchAt = null;

    tx.update(queueRef, {
      participants: updated.participants,
      requirements: updated.requirements,
      isReady: updated.isReady,
      status: updated.status,
      launchAt: null
    });

    return { queue: { ...updated, id: queueDocId } };
  };

  let txResult;
  if (typeof db.runTransaction === 'function') {
    txResult = await db.runTransaction(applyLeave);
  } else {
    txResult = await applyLeave({
      get: (ref) => ref.get(),
      update: (ref, data) => ref.update(data)
    });
  }

  if (txResult.error === 'launching') {
    return {
      success: false,
      message: `@${viewerUsername} Cannot leave — the queue is launching right now.`
    };
  }
  if (txResult.error === 'not_in_queue' || txResult.error === 'not_found') {
    return {
      success: false,
      message: `@${viewerUsername} You're not in that queue!`
    };
  }

  const foundQueue = txResult.queue;
  const statusStr = formatQueueStatus(foundQueue);

  return {
    success: true,
    queue: foundQueue,
    message: `${viewerUsername} left the queue ${foundQueue.code}.\n${statusStr}`,
    cancelledLaunch: true
  };
}

export async function cancelQueue(battlefieldId) {
  const queueDoc = await db.collection('battlefieldQueues').doc(battlefieldId).get();
  if (!queueDoc.exists) {
    return { success: false, message: 'No active queue to cancel!' };
  }
  const queue = queueDoc.data();
  await queueDoc.ref.delete();
  return {
    success: true,
    message: `❌ ${queue.name} queue (code: ${queue.code}) has been cancelled!`,
    queue: { ...queue, id: battlefieldId }
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
 * @param {{ force?: boolean }} options
 */
export async function claimQueueForLaunch(battlefieldId, options = {}) {
  const { force = false } = options;
  const ref = db.collection('battlefieldQueues').doc(battlefieldId);

  const tryClaim = async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      return { claimed: false, reason: 'missing' };
    }
    const queue = snap.data();

    if (queue.status === QUEUE_STATUS.LAUNCHING) {
      return { claimed: false, reason: 'launching' };
    }

    if (queue.status !== QUEUE_STATUS.OPEN && queue.status !== QUEUE_STATUS.READY) {
      return { claimed: false, reason: 'bad_status' };
    }

    if (!queue.isReady || !areRolesFilled(queue)) {
      return { claimed: false, reason: 'not_ready' };
    }

    if (!force) {
      if (queue.status !== QUEUE_STATUS.READY) {
        return { claimed: false, reason: 'not_ready_status' };
      }
      const launchMs = timestampToMillis(queue.launchAt);
      if (launchMs == null || launchMs > Date.now()) {
        return { claimed: false, reason: 'not_due' };
      }
    }

    tx.update(ref, { status: QUEUE_STATUS.LAUNCHING });
    return { claimed: true, queue };
  };

  if (typeof db.runTransaction === 'function') {
    return db.runTransaction(tryClaim);
  }
  return tryClaim({
    get: (r) => r.get(),
    update: (r, d) => r.update(d)
  });
}

async function recoverQueueAfterFailedLaunch(battlefieldId, queue, error) {
  console.error('[Queue] Launch failed — recovering queue', battlefieldId, error?.message || error);
  const ref = db.collection('battlefieldQueues').doc(battlefieldId);
  const stillReady = areRolesFilled(queue);
  await ref.update({
    status: stillReady ? QUEUE_STATUS.READY : QUEUE_STATUS.OPEN,
    isReady: stillReady,
    launchAt: stillReady
      ? admin.firestore.Timestamp.fromDate(new Date(Date.now() + LAUNCH_COUNTDOWN_MS))
      : null,
    lastLaunchError: error?.message || String(error || 'launch_failed'),
    lastLaunchErrorAt: admin.firestore.FieldValue.serverTimestamp()
  });
}

export async function notifyInstanceLaunched(queue, launchResult) {
  if (!launchResult?.success || !queue?.streamerId) {
    return;
  }
  try {
    const { broadcastToRoom } = await import('../websocket/server.js');
    broadcastToRoom(queue.streamerId, {
      type: 'instance_launched',
      instanceId: launchResult.instanceId,
      instance: launchResult.instance
    });
  } catch (err) {
    console.error('[Queue] Failed to broadcast instance_launched:', err);
  }
}

export async function launchInstance(battlefieldId, queue) {
  console.log(`[Queue] Launching ${queue.type} instance:`, queue.name);

  const mapped = resolveQueueContentId(queue.type, queue.queueKey || queue.instanceId);
  const contentId = queue.contentId || (mapped.ok ? mapped.contentId : null);
  if (!contentId) {
    return { success: false, message: 'Invalid queue content mapping' };
  }

  const participantData = await loadParticipantRows(queue);
  if (participantData.length === 0) {
    return { success: false, message: 'No valid participants for launch' };
  }

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
 * Claim (optional force) then launch; recover queue doc if launch fails.
 */
export async function attemptQueueLaunch(battlefieldId, options = {}) {
  const claim = await claimQueueForLaunch(battlefieldId, options);
  if (!claim.claimed || !claim.queue) {
    return { launched: false, reason: claim.reason || 'not_claimed' };
  }

  try {
    const result = await launchInstance(battlefieldId, claim.queue);
    if (!result.success) {
      await recoverQueueAfterFailedLaunch(battlefieldId, claim.queue, new Error(result.message));
      return { launched: false, result, queue: claim.queue };
    }
    await notifyInstanceLaunched(claim.queue, result);
    return { launched: true, result, queue: claim.queue };
  } catch (err) {
    await recoverQueueAfterFailedLaunch(battlefieldId, claim.queue, err);
    throw err;
  }
}

export async function tryLaunchDueQueue(battlefieldId) {
  return attemptQueueLaunch(battlefieldId, { force: false });
}

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
    const outcome = await attemptQueueLaunch(doc.id, { force: false });
    if (outcome.launched) {
      launched.push({ battlefieldId: doc.id, ...outcome });
    }
  }
  return launched;
}

export async function joinQueueByBattlefieldDocId(queueDocId, hero, userId, options = {}) {
  const queueDoc = await resolveQueueDocument(queueDocId);
  if (!queueDoc) {
    return { success: false, message: 'Queue not found' };
  }
  const queue = queueDoc.data();
  return joinQueue(queue.code, hero, hero.name || userId, userId, {
    expectedType: options.expectedType,
    expectedBattlefieldId: options.expectedBattlefieldId ?? queue.battlefieldId
  });
}
