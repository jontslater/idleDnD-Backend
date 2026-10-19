import { ROLE_CONFIG } from '../roleConfig.js';

const CASTER_CLASSES = new Set([
  'mage',
  'warlock',
  'necromancer',
  'frostmage',
  'firemage',
  'dragonsorcerer',
  'stormcaller',
  'mooncaller',
  'shadowpriest',
  'chronomancer'
]);

export function roleGroupFromHero(hero) {
  const classKey = (hero?.role || hero?.class || 'berserker').toLowerCase();
  const cat = ROLE_CONFIG[classKey]?.category || 'dps';
  if (cat === 'tank') return 'tank';
  if (cat === 'healer') return 'healer';
  return CASTER_CLASSES.has(classKey) ? 'caster' : 'melee';
}
