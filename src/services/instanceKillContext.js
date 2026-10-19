import { INSTANCE_STATUS } from '../constants/instanceStatus.js';

function isActiveInstance(status) {
  return status === INSTANCE_STATUS.IN_PROGRESS || status === 'in-progress' || status === 'active';
}

function heroIsParticipant(instance, hero) {
  const heroId = hero.id;
  const twitchId = hero.twitchUserId;
  const ids = instance.participantIds || [];
  if (ids.includes(heroId) || ids.includes(twitchId)) return true;
  const parts = instance.participants || [];
  return parts.some(
    (p) => p.heroId === heroId || p.userId === heroId || p.userId === twitchId || p.twitchUserId === twitchId
  );
}

/**
 * If kill references an active instance the hero joined, tag content for dungeon/raid loot tables.
 */
export async function resolveInstanceLootContext(db, kill, hero) {
  const instanceId = kill.instanceId || kill.instance_id;
  if (!instanceId) return kill;

  const raidDoc = await db.collection('raidInstances').doc(String(instanceId)).get();
  if (raidDoc.exists) {
    const instance = raidDoc.data();
    if (isActiveInstance(instance.status) && heroIsParticipant(instance, hero)) {
      return {
        ...kill,
        contentType: 'raid',
        difficulty: instance.difficulty || kill.difficulty || 'normal',
        contentId: instance.raidId || instance.contentId || kill.contentId
      };
    }
    return kill;
  }

  const dungeonDoc = await db.collection('dungeonInstances').doc(String(instanceId)).get();
  if (dungeonDoc.exists) {
    const instance = dungeonDoc.data();
    if (isActiveInstance(instance.status) && heroIsParticipant(instance, hero)) {
      return {
        ...kill,
        contentType: 'dungeon',
        difficulty: instance.difficulty || kill.difficulty || 'normal',
        contentId: instance.dungeonId || instance.contentId || kill.contentId
      };
    }
  }

  return kill;
}
