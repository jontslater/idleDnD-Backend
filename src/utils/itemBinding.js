/**
 * WoW-style item binding: bop | boe | account | none
 * After equip, boe items become bop (soulbound).
 */

export const ITEM_BINDINGS = Object.freeze(['bop', 'boe', 'account', 'none']);

export const BINDING_RULES = Object.freeze({
  bop: {
    label: 'Bind on Pickup',
    playerTradable: false,
    vendorSellable: true
  },
  boe: {
    label: 'Bind on Equip',
    playerTradable: true,
    vendorSellable: true
  },
  account: {
    label: 'Account Bound',
    playerTradable: false,
    vendorSellable: false
  },
  none: {
    label: 'Unbound',
    playerTradable: true,
    vendorSellable: true
  }
});

function isStackableUnbound(item) {
  if (!item || item.slot) return false;
  const type = String(item.type || '').toLowerCase();
  if (type === 'material' || type === 'consumable' || type === 'potion' || type === 'buff') return true;
  const name = String(item.name || '').toLowerCase();
  if (name.includes('potion') || name.includes('scroll') || name.includes('ore') || name.includes('herb')) {
    return true;
  }
  return !item.slot;
}

/**
 * Default binding for legacy items missing the field.
 */
export function inferDefaultBinding(item) {
  if (!item) return 'bop';
  if (item.accountBound || item.cosmeticId || item.founderExclusive) return 'account';
  if (isStackableUnbound(item)) return 'none';
  if (item.slot) return 'bop';
  return 'none';
}

export function normalizeBinding(item) {
  if (!item) return item;
  const binding = ITEM_BINDINGS.includes(item.binding) ? item.binding : inferDefaultBinding(item);
  if (binding === item.binding) return item;
  return { ...item, binding };
}

/**
 * Binding for server-generated gear.
 */
export function bindingForGeneratedGear({ source = {}, setId, isSetPiece, legendaryId, rarity }) {
  if (setId || isSetPiece) return 'bop';
  if (legendaryId || rarity === 'legendary' || rarity === 'mythic') return 'bop';
  const type = source.type || 'idle';
  if (type === 'raid' || type === 'dungeon' || type === 'worldboss') return 'bop';
  if (type === 'idle' || type === 'elite') return 'boe';
  return 'bop';
}

export function resolveBinding(item) {
  if (!item) return 'bop';
  if (ITEM_BINDINGS.includes(item.binding)) return item.binding;
  return inferDefaultBinding(item);
}

export function isPlayerTradable(item) {
  const binding = resolveBinding(item);
  return BINDING_RULES[binding].playerTradable;
}

export function isVendorSellable(item) {
  const binding = resolveBinding(item);
  return BINDING_RULES[binding].vendorSellable;
}

/**
 * @param {'mail'|'auction'|'trade'|'sell'} action
 */
export function bindingViolation(item, action) {
  if (!item) return { error: 'Invalid item', code: 'ITEM_INVALID' };
  const binding = resolveBinding(item);
  if (action === 'sell') {
    if (!isVendorSellable(item)) {
      return {
        error: 'Account-bound items cannot be sold to a vendor',
        code: 'ITEM_NOT_VENDOR_SELLABLE',
        binding
      };
    }
    return null;
  }
  if (!isPlayerTradable(item)) {
    const verb = action === 'mail' ? 'sent by mail' : action === 'auction' ? 'listed on the auction house' : 'traded';
    return {
      error: `Item cannot be ${verb} (${binding} binding)`,
      code: 'ITEM_NOT_TRADEABLE',
      binding
    };
  }
  return null;
}

/** boe → bop when equipped (soulbound). */
export function applyBindOnEquip(item) {
  if (!item) return item;
  const normalized = normalizeBinding(item);
  if (normalized.binding === 'boe') {
    return { ...normalized, binding: 'bop', soulboundFromEquip: true };
  }
  return normalized;
}

export function withBindingMetadata(catalog) {
  return {
    ...catalog,
    bindings: ITEM_BINDINGS,
    bindingRules: BINDING_RULES
  };
}
