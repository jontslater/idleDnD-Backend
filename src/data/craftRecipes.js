/**
 * Server-authoritative crafting costs (client body cost is ignored).
 * Extend this table when adding profession recipes.
 */
const RECIPES = {
  herbalism: {
    basic_health_potion: { herbs: { common: 3 } },
    powerful_health_potion: { herbs: { uncommon: 2, common: 1 } },
    superior_health_potion: { herbs: { rare: 2, uncommon: 1 } },
    legendary_elixir: { herbs: { epic: 1, rare: 2 } }
  },
  mining: {
    iron_whetstone: { ore: { iron: 3 } },
    steel_reinforcement: { ore: { steel: 2, iron: 1 } },
    mithril_edge: { ore: { mithril: 2, steel: 1 } },
    adamantite_fortification: { ore: { adamantite: 2, mithril: 1 } },
    gem_socket: { gold: 500 }
  },
  enchanting: {
    minor_rune: { essence: 5 },
    fiery_weapon: { essence: 12 },
    frozen_armor: { essence: 12 },
    swiftness_enchant: { essence: 8 }
  }
};

export function getServerRecipeCost(professionType, recipeKey) {
  const table = RECIPES[professionType];
  if (!table) return null;
  return table[recipeKey] || null;
}
