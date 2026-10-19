/**
 * Hero activeInstance helpers (queue join + instance completion).
 */

import admin from 'firebase-admin';
import { db } from '../index.js';
import { isInstanceInProgress } from '../constants/instanceStatus.js';

export async function clearActiveInstanceForHero(heroId) {
  if (!heroId) return;
  try {
    await db.collection('heroes').doc(heroId).update({
      activeInstance: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (err) {
    console.error(`[HeroInstance] Failed to clear activeInstance for ${heroId}:`, err);
  }
}

export async function clearActiveInstanceForParticipants(participants) {
  if (!Array.isArray(participants)) return;
  const heroIds = new Set();
  for (const p of participants) {
    if (p?.heroId) heroIds.add(p.heroId);
    else if (p?.userId && typeof p.userId === 'string' && p.userId.length > 10) {
      heroIds.add(p.userId);
    }
  }
  await Promise.all([...heroIds].map((id) => clearActiveInstanceForHero(id)));
}

/**
 * If activeInstance points at a finished/missing instance, clear it on the hero doc.
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export async function validateActiveInstanceForQueueJoin(hero, targetBattlefieldId, viewerUsername) {
  if (!hero.activeInstance?.instanceId) {
    return { ok: true };
  }

  const type = hero.activeInstance.type === 'raid' ? 'raid' : 'dungeon';
  const coll = type === 'raid' ? 'raidInstances' : 'dungeonInstances';
  const instDoc = await db.collection(coll).doc(hero.activeInstance.instanceId).get();

  if (!instDoc.exists) {
    await clearActiveInstanceForHero(hero.id);
    return { ok: true };
  }

  const inst = instDoc.data();
  if (!isInstanceInProgress(inst.status)) {
    await clearActiveInstanceForHero(hero.id);
    return { ok: true };
  }

  if (inst.battlefieldId && inst.battlefieldId !== targetBattlefieldId) {
    return {
      ok: false,
      message: `@${viewerUsername} You're in an active ${type} on another stream. Finish it before joining this queue.`
    };
  }

  return { ok: true };
}
