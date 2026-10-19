/**
 * Guild create/update allow-lists. Progression, roster, and loot are server-managed.
 */

import admin from 'firebase-admin';

export const GUILD_PLAYER_EDITABLE_FIELDS = new Set([
  'name',
  'description',
  'tag',
  'motto',
  'emblemUrl',
  'bannerUrl',
  'joinMode',
  'settings',
  'recruitmentMessage'
]);

export const GUILD_FORBIDDEN_CLIENT_FIELDS = [
  'level',
  'gold',
  'maxMembers',
  'memberIds',
  'members',
  'guildLoot',
  'lootHistory',
  'bank',
  'perks',
  'craftingStations',
  'pendingApplications',
  'xp',
  'itemScore'
];

export function pickGuildEditableFields(body) {
  if (!body || typeof body !== 'object') {
    return { allowed: {}, rejected: [] };
  }
  const allowed = {};
  const rejected = [];
  for (const [key, value] of Object.entries(body)) {
    if (GUILD_PLAYER_EDITABLE_FIELDS.has(key)) {
      allowed[key] = value;
    } else if (key !== 'createdBy' && key !== 'heroId') {
      rejected.push(key);
    }
  }
  return { allowed, rejected };
}

export const DEFAULT_GUILD_MAX_MEMBERS = 30;

export function buildNewGuildDocument({ createdBy, editable }) {
  const joinMode =
    editable.joinMode === 'approval' || editable.joinMode === 'open' ? editable.joinMode : 'open';

  return {
    name: editable.name,
    description: editable.description || '',
    tag: editable.tag || null,
    motto: editable.motto || '',
    emblemUrl: editable.emblemUrl || null,
    bannerUrl: editable.bannerUrl || null,
    recruitmentMessage: editable.recruitmentMessage || '',
    settings: editable.settings || {},
    joinMode,
    createdBy,
    level: 1,
    gold: 0,
    maxMembers: DEFAULT_GUILD_MAX_MEMBERS,
    memberIds: [createdBy],
    members: [],
    pendingApplications: [],
    guildLoot: [],
    lootHistory: [],
    bank: { gold: 0, materials: {} },
    perks: {},
    craftingStations: [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}
