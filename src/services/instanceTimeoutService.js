/**
 * Mark long-running dungeon/raid instances as failed (server timeout) and clear hero locks.
 */

import admin from 'firebase-admin';
import { db } from '../index.js';
import { INSTANCE_STATUS, isInstanceInProgress } from '../constants/instanceStatus.js';
import { clearActiveInstanceForParticipants } from './heroInstanceService.js';

const DEFAULT_MAX_MS = 2 * 60 * 60 * 1000;

function timestampToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'number') return ts;
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return null;
}

function instanceReferenceTime(data) {
  return (
    timestampToMillis(data.startedAt) ||
    timestampToMillis(data.updatedAt) ||
    timestampToMillis(data.createdAt) ||
    null
  );
}

/**
 * @param {number} [maxDurationMs]
 * @returns {Promise<{ dungeons: number, raids: number }>}
 */
export async function sweepStaleInstances(maxDurationMs) {
  const maxMs = maxDurationMs ?? (
    process.env.INSTANCE_MAX_DURATION_MS
      ? parseInt(process.env.INSTANCE_MAX_DURATION_MS, 10)
      : DEFAULT_MAX_MS
  );
  const cutoff = Date.now() - maxMs;
  let dungeons = 0;
  let raids = 0;

  const collections = [
    { name: 'dungeonInstances', type: 'dungeon' },
    { name: 'raidInstances', type: 'raid' }
  ];

  for (const { name } of collections) {
    const snap = await db.collection(name).get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (!isInstanceInProgress(data.status)) {
        continue;
      }
      const refTime = instanceReferenceTime(data);
      if (refTime == null || refTime > cutoff) {
        continue;
      }

      await doc.ref.update({
        status: INSTANCE_STATUS.FAILED,
        abandonReason: 'server_timeout',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await clearActiveInstanceForParticipants(data.participants || []);

      if (name === 'dungeonInstances') {
        dungeons++;
      } else {
        raids++;
      }
    }
  }

  if (dungeons > 0 || raids > 0) {
    console.log(`[InstanceTimeout] Timed out ${dungeons} dungeon(s), ${raids} raid(s)`);
  }

  return { dungeons, raids };
}
