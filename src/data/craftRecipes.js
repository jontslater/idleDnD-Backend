/**
 * Server-authoritative crafting costs (client body cost is ignored).
 * Keys align with FE profession recipes (!recipes / portal).
 */
const RECIPES = {
  herbalism: {
    basic_potion: { herbs: { common: 3 } },
    powerful_potion: { herbs: { uncommon: 2, common: 1 } },
    superior_potion: { herbs: { rare: 2, uncommon: 1 } },
    legendary_potion: { herbs: { epic: 1, rare: 2 } },
    basic_elixir: { herbs: { common: 4 } },
    powerful_elixir: { herbs: { uncommon: 3 } },
    superior_elixir: { herbs: { rare: 2, uncommon: 2 } },
    legendary_elixir: { herbs: { epic: 1, uncommon: 3 } },
    restoration_draught: { herbs: { uncommon: 2, common: 2 } },
    vigor_tonic: { herbs: { rare: 1, uncommon: 2 } },
    mana_draught: { herbs: { uncommon: 3, common: 1 } },
    champions_flask: { herbs: { epic: 1, rare: 1, uncommon: 2 } }
  },
  mining: {
    iron_whetstone: { ore: { iron: 3 } },
    steel_whetstone: { ore: { steel: 2, iron: 1 } },
    mithril_whetstone: { ore: { mithril: 2, steel: 1 } },
    adamantite_whetstone: { ore: { adamantite: 2, mithril: 1 } },
    iron_plating: { ore: { iron: 4 } },
    steel_plating: { ore: { steel: 3, iron: 1 } },
    mithril_plating: { ore: { mithril: 2, steel: 2 } },
    adamantite_plating: { ore: { adamantite: 2, mithril: 2 } },
    iron_reinforcement: { ore: { iron: 5 } },
    steel_reinforcement: { ore: { steel: 3, iron: 2 } },
    mithril_reinforcement: { ore: { mithril: 3, steel: 1 } },
    adamantite_reinforcement: { ore: { adamantite: 3, mithril: 1 } },
    gem_socket: { gold: 500 }
  },
  enchanting: {
    minor_fiery_weapon: { essence: 5 },
    minor_vampiric: { essence: 5 },
    minor_arcane: { essence: 5 },
    fiery_weapon: { essence: 12 },
    vampiric: { essence: 12 },
    arcane: { essence: 12 },
    legendary_fiery_weapon: { essence: 25 },
    legendary_vampiric: { essence: 25 },
    legendary_arcane: { essence: 25 },
    swiftness_rune: { essence: 8 },
    resilience_rune: { essence: 8 },
    power_rune: { essence: 10 }
  }
};

export function getServerRecipeCost(professionType, recipeKey) {
  const table = RECIPES[professionType];
  if (!table) return null;
  return table[recipeKey] || null;
}

export function listCraftRecipes() {
  return RECIPES;
}
