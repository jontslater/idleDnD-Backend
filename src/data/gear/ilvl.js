import { ILVL_CAP } from './budget.js';
import { LEVEL_BANDS } from '../balance.js';

export function ilvlFromSource(source) {
  const type = source?.type || 'idle';
  const enemyLevel = Math.max(1, source?.enemyLevel || source?.level || 1);
  const difficulty = source?.difficulty || 'normal';
  const contentId = source?.contentId;

  let ilvl = enemyLevel;
  if (type === 'elite') ilvl = enemyLevel + 1;
  else if (type === 'dungeon') {
    const band = LEVEL_BANDS.dungeon.find((d) => d.id === contentId) || { max: enemyLevel };
    const top = band.max || enemyLevel;
    if (difficulty === 'mythic') ilvl = top + 6;
    else if (difficulty === 'heroic') ilvl = top + 4;
    else ilvl = top + 2;
  } else if (type === 'raid') {
    const band = LEVEL_BANDS.raid.find((r) => r.id === contentId) || { max: enemyLevel };
    const top = band.max || enemyLevel;
    if (difficulty === 'mythic') ilvl = top + 11;
    else if (difficulty === 'heroic') ilvl = top + 8;
    else ilvl = top + 5;
  } else if (type === 'worldboss') {
    ilvl = enemyLevel + 12;
  }

  return Math.min(ILVL_CAP, Math.max(1, Math.floor(ilvl)));
}
