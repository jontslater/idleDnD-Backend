/** Server-authoritative vendor sell prices (shared by auction + inventory sell). */

export function getVendorSellPrice(item) {
  if (!item || typeof item !== 'object') return 0;

  const rarityMultipliers = {
    common: 1,
    uncommon: 5,
    rare: 20,
    epic: 100,
    legendary: 500,
    mythic: 800
  };

  const basePrice = rarityMultipliers[item.rarity || 'common'] || 1;

  if (item.slot) {
    return basePrice * 10;
  }
  if (item.type === 'potion' || item.type === 'buff' || item.name?.toLowerCase().includes('potion')) {
    return basePrice * 2;
  }
  return basePrice;
}
