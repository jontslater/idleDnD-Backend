/**
 * Premium tokens (Stripe token packs) may only be spent on cosmetics — no gameplay power.
 */

export const TOKEN_SINK_COSMETIC_ONLY_CODE = 'TOKEN_SINK_COSMETIC_ONLY';

export const COSMETIC_TOKEN_CATALOG = {
  name_color_gold: { price: 500, label: 'Gold chat name color', grants: { cosmetics: { nameColor: '#FFD700' } } },
  name_color_crimson: { price: 500, label: 'Crimson chat name color', grants: { cosmetics: { nameColor: '#DC143C' } } },
  portrait_frame_bronze: { price: 800, label: 'Bronze portrait frame', grants: { cosmetics: { portraitFrame: 'bronze' } } },
  portrait_frame_silver: { price: 1200, label: 'Silver portrait frame', grants: { cosmetics: { portraitFrame: 'silver' } } },
  title_flair_hero: { price: 1500, label: 'Hero title flair', grants: { unlockedTitles: ['Token Hero'], activeTitle: 'Token Hero' } }
};

export function listCosmeticTokenCatalog() {
  return Object.entries(COSMETIC_TOKEN_CATALOG).map(([id, item]) => ({
    id,
    price: item.price,
    label: item.label
  }));
}

export function isGameplayTokenSinkAllowed() {
  return false;
}

export function gameplayTokenSinkResponse() {
  return {
    error:
      'Premium tokens are cosmetic-only. Gear, stats, XP boosts, and loot boxes cannot be purchased with tokens. See GET /api/balance tokenPolicy and docs/BALANCE.md.',
    code: TOKEN_SINK_COSMETIC_ONLY_CODE,
    cosmeticCatalog: listCosmeticTokenCatalog()
  };
}
