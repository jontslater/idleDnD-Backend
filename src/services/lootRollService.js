import { rollLoot, SET_PIECE_RATES, KILL_DROP_CHANCES } from '../data/lootConfig.js';
import { generateGearItem } from '../data/gear/generator.js';
import { roleGroupFromHero } from '../data/gear/roleGroup.js';
import { ilvlFromSource } from '../data/gear/ilvl.js';
import { pickSetForSource, SET_SLOTS } from '../data/gear/sets.js';
import { GEAR_SLOTS } from '../data/gear/bases.js';

const SET_PITY_THRESHOLDS = { dungeon: 6, raid: 4 };

function contentKey(source) {
  const t = source.type || 'idle';
  const d = source.difficulty || 'normal';
  const c = source.contentId || 'default';
  return `${t}:${d}:${c}`;
}

function shouldDrop(kill) {
  const kind = kill.kind || kill.enemyKind || 'normal';
  if (kind === 'boss' || kind === 'dungeonBoss' || kind === 'raidBoss') return true;
  if (kind === 'elite') return Math.random() < KILL_DROP_CHANCES.elite;
  return Math.random() < KILL_DROP_CHANCES.normal;
}

function pickSlot(roleGroup, rnd = Math.random) {
  const slots = roleGroup === 'tank' ? GEAR_SLOTS : GEAR_SLOTS.filter((s) => s !== 'shield');
  return slots[Math.floor(rnd() * slots.length)];
}

function pickSetSlot(setId, ownedSlots = []) {
  const missing = SET_SLOTS.filter((s) => !ownedSlots.includes(s));
  if (missing.length) return missing[Math.floor(Math.random() * missing.length)];
  return SET_SLOTS[Math.floor(Math.random() * SET_SLOTS.length)];
}

function mapKillToSource(kill) {
  const enemyLevel = kill.enemyLevel || kill.level || 1;
  let type = 'idle';
  if (kill.contentType) type = kill.contentType;
  else if (kill.kind === 'elite') type = 'elite';
  else if (kill.kind === 'dungeonBoss') type = 'dungeon';
  else if (kill.kind === 'raidBoss') type = 'raid';
  else if (kill.kind === 'worldboss') type = 'worldboss';
  return {
    type,
    enemyLevel,
    difficulty: kill.difficulty || 'normal',
    contentId: kill.contentId,
    ilvl: ilvlFromSource({ type, enemyLevel, difficulty: kill.difficulty, contentId: kill.contentId })
  };
}

function setPieceRate(source) {
  const t = source.type;
  const d = source.difficulty || 'normal';
  if (t === 'dungeon') return SET_PIECE_RATES.dungeon[d] || 0.15;
  if (t === 'raid' || t === 'worldboss') return SET_PIECE_RATES.raid[d] || SET_PIECE_RATES.worldboss || 0.3;
  return 0;
}

/**
 * Roll one loot item for a hero kill (server authoritative).
 */
export function rollLootForKill(hero, kill, heroState = {}) {
  if (!shouldDrop(kill)) return { dropped: false };

  const roleGroup = roleGroupFromHero(hero);
  const source = mapKillToSource(kill);
  const key = contentKey(source);
  const pity = { ...(heroState.lootPity?.[key] || {}) };
  const setCollection = heroState.setCollection || {};

  let contentType = 'trash';
  let difficulty = source.difficulty;
  if (source.type === 'elite') contentType = 'elite';
  else if (source.type === 'dungeon') contentType = 'dungeon';
  else if (source.type === 'raid') contentType = 'raid';
  else if (source.type === 'worldboss') contentType = 'worldboss';

  const pityCounter = pity.sinceEpic || 0;
  const { rarity, triggeredPity } = rollLoot(contentType, difficulty, pityCounter);

  let forceSet = false;
  const setPityKey = source.type === 'dungeon' ? 'dungeon' : source.type === 'raid' ? 'raid' : null;
  if (setPityKey) {
    const since = pity.sinceSetPiece || 0;
    if (since >= SET_PITY_THRESHOLDS[setPityKey]) forceSet = true;
  }

  let isSetPiece = forceSet;
  if (!isSetPiece && ['dungeon', 'raid', 'worldboss'].includes(source.type)) {
    isSetPiece = Math.random() < setPieceRate(source);
  }

  let setId = null;
  let slot = pickSlot(roleGroup);
  if (isSetPiece) {
    const set = pickSetForSource(roleGroup, source);
    if (set) {
      setId = set.id;
      const owned = setCollection[set.id] || [];
      slot = pickSetSlot(set.id, owned);
      pity.sinceSetPiece = 0;
    }
  } else if (setPityKey) {
    pity.sinceSetPiece = (pity.sinceSetPiece || 0) + 1;
  }

  if (rarity === 'epic' || rarity === 'legendary') {
    pity.sinceEpic = 0;
  } else {
    pity.sinceEpic = (pity.sinceEpic || 0) + 1;
  }

  const seed = `${hero.id || hero.twitchUserId}-${key}-${Date.now()}-${Math.random()}`;
  const item = generateGearItem({
    roleGroup,
    slot,
    rarity: triggeredPity ? rarity : rarity,
    source,
    seed,
    setId,
    isSetPiece: Boolean(setId)
  });

  const updatedCollection = { ...setCollection };
  if (setId) {
    const slots = new Set(updatedCollection[setId] || []);
    slots.add(slot);
    updatedCollection[setId] = [...slots];
  }

  return {
    dropped: true,
    item,
    pity: { ...heroState.lootPity, [key]: pity },
    setCollection: updatedCollection
  };
}

export function rollRaidBossDrops(hero, source, dropsPerPlayer = 2) {
  const items = [];
  let state = { lootPity: hero.lootPity || {}, setCollection: hero.setCollection || {} };
  for (let i = 0; i < dropsPerPlayer; i++) {
    const res = rollLootForKill(hero, { ...source, kind: 'raidBoss', contentType: 'raid' }, state);
    if (res.dropped && res.item) {
      items.push(res.item);
      state = { lootPity: res.pity, setCollection: res.setCollection };
    }
  }
  return { items, lootPity: state.lootPity, setCollection: state.setCollection };
}
