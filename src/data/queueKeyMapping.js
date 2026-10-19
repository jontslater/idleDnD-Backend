/**
 * Maps chat/portal queue keys to real dungeonId / raidId in data files.
 */

import { getDungeonById } from './dungeons.js';
import { getRaidById } from './raids.js';

/** @type {Record<string, string>} */
export const DUNGEON_QUEUE_KEY_TO_ID = {
  normal: 'ancient_catacombs',
  heroic: 'demon_ruins',
  // No dedicated mythic dungeon in data — highest available challenge dungeon
  mythic: 'demon_ruins'
};

/** @type {Record<string, string>} */
export const RAID_QUEUE_KEY_TO_ID = {
  elder_dragon_normal: 'elder_dragon_normal',
  elder_dragon_heroic: 'elder_dragon_heroic',
  elder_dragon_mythic: 'elder_dragon_mythic',
  corrupted_temple: 'corrupted_temple',
  bandit_stronghold: 'bandit_stronghold'
};

/**
 * @param {'dungeon'|'raid'} type
 * @param {string} queueKey
 * @returns {{ ok: true, contentId: string } | { ok: false, message: string }}
 */
export function resolveQueueContentId(type, queueKey) {
  const key = (queueKey || '').trim();
  if (!key) {
    return { ok: false, message: 'Missing queue key' };
  }

  if (type === 'dungeon') {
    const contentId = DUNGEON_QUEUE_KEY_TO_ID[key];
    if (!contentId || !getDungeonById(contentId)) {
      return { ok: false, message: `Unknown dungeon queue key: ${key}` };
    }
    return { ok: true, contentId };
  }

  if (type === 'raid') {
    const contentId = RAID_QUEUE_KEY_TO_ID[key];
    if (!contentId || !getRaidById(contentId)) {
      return { ok: false, message: `Unknown raid queue key: ${key}` };
    }
    return { ok: true, contentId };
  }

  return { ok: false, message: 'Invalid queue type' };
}

export function listKnownDungeonQueueKeys() {
  return Object.keys(DUNGEON_QUEUE_KEY_TO_ID);
}

export function listKnownRaidQueueKeys() {
  return Object.keys(RAID_QUEUE_KEY_TO_ID);
}
