/**
 * Server-authoritative cosmetics catalog (starter launch set + founder exclusives).
 * @typedef {'skin'|'nameColor'|'frame'|'killFx'|'levelFx'|'chargeBar'|'title'|'badge'|'auraEffect'|'spellEffect'|'pet'|'banner'} CosmeticCategory
 */

const founderBadge = (tier) => ({
  id: `founder_badge_${tier}`,
  category: 'badge',
  name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Founder Badge`,
  priceTokens: 0,
  rarity: 'founder',
  purchasable: false,
  source: 'founder',
  render: { imagePath: `/Badges/Founders${tier.charAt(0).toUpperCase() + tier.slice(1)}.png` }
});

const founderNameColor = (tier, hex) => ({
  id: `founder_name_${tier}`,
  category: 'nameColor',
  name: `${tier} founder name color`,
  priceTokens: 0,
  rarity: 'founder',
  purchasable: false,
  source: 'founder',
  render: { color: hex }
});

const storeItems = [
  { id: 'name_iron', category: 'nameColor', name: 'Iron Nameplate', priceTokens: 100, rarity: 'common', purchasable: true, source: 'store', render: { color: '#9CA3AF' } },
  { id: 'name_emerald', category: 'nameColor', name: 'Emerald Nameplate', priceTokens: 100, rarity: 'common', purchasable: true, source: 'store', render: { color: '#10B981' } },
  { id: 'name_sunset_gradient', category: 'nameColor', name: 'Sunset Gradient', priceTokens: 300, rarity: 'rare', purchasable: true, source: 'store', render: { color: '#F97316', gradient: true } },
  { id: 'frame_iron', category: 'frame', name: 'Iron Frame', priceTokens: 250, rarity: 'common', purchasable: true, source: 'store', render: { frameId: 'iron' } },
  { id: 'frame_rune', category: 'frame', name: 'Rune Frame', priceTokens: 250, rarity: 'uncommon', purchasable: true, source: 'store', render: { frameId: 'rune' } },
  { id: 'kill_sparkle', category: 'killFx', name: 'Sparkle Kill FX', priceTokens: 300, rarity: 'uncommon', purchasable: true, source: 'store', render: { effectId: 'sparkle' } },
  { id: 'level_firework', category: 'levelFx', name: 'Firework Level-up', priceTokens: 300, rarity: 'uncommon', purchasable: true, source: 'store', render: { effectId: 'firework' } },
  { id: 'charge_flame', category: 'chargeBar', name: 'Flame Charge Bar', priceTokens: 150, rarity: 'common', purchasable: true, source: 'store', render: { variant: 'flame' } },
  { id: 'title_the_idle', category: 'title', name: 'the Idle', priceTokens: 150, rarity: 'common', purchasable: true, source: 'store', render: { title: 'the Idle' } },
  { id: 'title_chat_champion', category: 'title', name: 'Chat Champion', priceTokens: 200, rarity: 'uncommon', purchasable: true, source: 'store', render: { title: 'Chat Champion' } },
  { id: 'skin_ashen_tank', category: 'skin', name: 'Ashen Tank', priceTokens: 400, rarity: 'common', purchasable: true, source: 'store', roleFilter: 'tank', render: { palette: 'ashen' } },
  { id: 'skin_verdant_healer', category: 'skin', name: 'Verdant Healer', priceTokens: 400, rarity: 'common', purchasable: true, source: 'store', roleFilter: 'healer', render: { palette: 'verdant' } }
];

const founderItems = [
  founderBadge('bronze'),
  founderBadge('silver'),
  founderBadge('gold'),
  founderBadge('platinum'),
  founderNameColor('bronze', '#CD7F32'),
  founderNameColor('silver', '#C0C0C0'),
  founderNameColor('gold', '#FFD700'),
  founderNameColor('platinum', '#E5E4E2'),
  { id: 'founder_frame_silver', category: 'frame', name: 'Founder Silver Frame', priceTokens: 0, rarity: 'founder', purchasable: false, source: 'founder', minFounderTier: 'silver', render: { frameId: 'founder_silver' } },
  { id: 'founder_aura_gold', category: 'auraEffect', name: 'Founder Gold Aura', priceTokens: 0, rarity: 'founder', purchasable: false, source: 'founder', minFounderTier: 'gold', render: { auraId: 'founder_gold' } },
  { id: 'founder_spell_gold', category: 'spellEffect', name: 'Founder Gold Spell', priceTokens: 0, rarity: 'founder', purchasable: false, source: 'founder', minFounderTier: 'gold', render: { spellId: 'founder_gold' } },
  { id: 'founder_title', category: 'title', name: 'Founder', priceTokens: 0, rarity: 'founder', purchasable: false, source: 'founder', render: { title: 'Founder' } }
];

export const COSMETICS_CATALOG = [...storeItems, ...founderItems];

const byId = new Map(COSMETICS_CATALOG.map((c) => [c.id, c]));

export function getCosmeticById(id) {
  return byId.get(id) || null;
}

export function listStoreCatalog() {
  return COSMETICS_CATALOG.map(({ id, category, name, priceTokens, rarity, purchasable, source, roleFilter }) => ({
    id,
    category,
    name,
    priceTokens,
    rarity,
    purchasable,
    source,
    roleFilter
  }));
}

/** Cosmetic IDs granted per founder tier (account-level). */
export const FOUNDER_TIER_COSMETIC_IDS = {
  bronze: ['founder_badge_bronze', 'founder_name_bronze', 'founder_title'],
  silver: ['founder_badge_silver', 'founder_name_silver', 'founder_frame_silver', 'founder_title'],
  gold: ['founder_badge_gold', 'founder_name_gold', 'founder_frame_silver', 'founder_aura_gold', 'founder_spell_gold', 'founder_title'],
  platinum: ['founder_badge_platinum', 'founder_name_platinum', 'founder_frame_silver', 'founder_aura_gold', 'founder_spell_gold', 'founder_title']
};

export const EQUIPPED_COSMETIC_SLOTS = new Set([
  'skin',
  'nameColor',
  'frame',
  'killFx',
  'levelFx',
  'chargeBar',
  'title',
  'badge',
  'auraEffect',
  'spellEffect',
  'pet'
]);
