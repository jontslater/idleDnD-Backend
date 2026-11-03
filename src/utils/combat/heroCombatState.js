/**
 * Server-authoritative hero HP / death state for idle battlefield combat.
 * Client combat runs in TNEWFE; this module keeps Firestore consistent when HP changes.
 */

/** Matches TNEWFE idle auto-resurrection timer (CleanBattlefieldSource). */
export const AUTO_RESURRECT_DELAY_MS = 60_000;

/** Matches !rest and healer combat res in commandHandler / TNEWFE. */
export const COMBAT_RESURRECT_HP_PERCENT = 0.5;

/**
 * Normalize HP and death flags so persisted heroes can reach 0 HP and stay marked dead.
 *
 * @param {object} hero - Hero fields to normalize (hp, maxHp, isDead, deathTime, shield optional)
 * @param {{ now?: number, explicitRevive?: boolean }} [options]
 * @returns {{ hp: number, maxHp: number, isDead: boolean, deathTime: number|null, shield?: number }}
 */
export function normalizeHeroCombatState(hero, options = {}) {
  const now = options.now ?? Date.now();
  const explicitRevive = options.explicitRevive === true;

  const maxHp = Math.max(
    1,
    Math.floor(hero.maxHp ?? hero.stats?.maxHp ?? hero.stats?.hp ?? 100)
  );
  let hp = Math.floor(hero.hp ?? maxHp);
  if (Number.isNaN(hp)) hp = maxHp;
  hp = Math.min(maxHp, Math.max(0, hp));

  let isDead = hero.isDead === true;
  let deathTime =
    hero.deathTime === null || hero.deathTime === undefined
      ? null
      : Number(hero.deathTime);

  if (hp <= 0) {
    hp = 0;
    if (!isDead) {
      isDead = true;
      deathTime = deathTime ?? now;
    }
  } else if (explicitRevive) {
    isDead = false;
    deathTime = null;
  } else if (!isDead) {
    deathTime = null;
  }

  const out = {
    hp,
    maxHp,
    isDead,
    deathTime: isDead ? deathTime : null
  };

  if (hero.shield !== undefined) {
    out.shield = Math.max(0, Math.floor(hero.shield || 0));
  }

  return out;
}

/**
 * Apply damage to a hero (shield first, then HP). No HP floor above 0.
 *
 * @param {object} hero
 * @param {number} rawDamage
 * @param {{ now?: number }} [options]
 * @returns {{ hero: object, hpDamage: number, shieldDamage: number, died: boolean, alreadyDead: boolean }}
 */
export function applyDamageToHero(hero, rawDamage, options = {}) {
  const now = options.now ?? Date.now();
  const maxHp = Math.max(1, Math.floor(hero.maxHp ?? 100));
  let hp = Math.floor(hero.hp ?? maxHp);
  let shield = Math.floor(hero.shield || 0);

  if (hero.isDead || hp <= 0) {
    const normalized = normalizeHeroCombatState(
      { ...hero, hp: 0, maxHp, isDead: true, shield },
      { now }
    );
    return {
      hero: { ...hero, ...normalized },
      hpDamage: 0,
      shieldDamage: 0,
      died: false,
      alreadyDead: true
    };
  }

  let remaining = Math.max(0, Math.floor(rawDamage));
  let shieldDamage = 0;
  let hpDamage = 0;

  if (shield > 0 && remaining > 0) {
    shieldDamage = Math.min(shield, remaining);
    shield -= shieldDamage;
    remaining -= shieldDamage;
  }

  if (remaining > 0) {
    hpDamage = Math.min(hp, remaining);
    hp = Math.max(0, hp - remaining);
  }

  const merged = { ...hero, hp, maxHp, shield, isDead: false, deathTime: null };
  const normalized = normalizeHeroCombatState(merged, { now });
  const died = normalized.isDead && !hero.isDead;

  return {
    hero: { ...hero, ...normalized },
    hpDamage,
    shieldDamage,
    died,
    alreadyDead: false
  };
}

/**
 * Heal a living hero (does not resurrect unless explicitRevive is used via normalize).
 */
export function applyHealToHero(hero, healAmount, options = {}) {
  const now = options.now ?? Date.now();
  const maxHp = Math.max(1, Math.floor(hero.maxHp ?? 100));
  let hp = Math.floor(hero.hp ?? 0);

  if (hero.isDead || hp <= 0) {
    return {
      hero: normalizeHeroCombatState({ ...hero, hp: 0, maxHp, isDead: true }, { now }),
      actualHeal: 0,
      resurrected: false
    };
  }

  const before = hp;
  hp = Math.min(maxHp, hp + Math.max(0, Math.floor(healAmount)));
  const normalized = normalizeHeroCombatState(
    { ...hero, hp, maxHp, isDead: false, deathTime: null },
    { now }
  );

  return {
    hero: { ...hero, ...normalized },
    actualHeal: normalized.hp - before,
    resurrected: false
  };
}

/**
 * Revive after wave wipe, !rest, or auto-res timer (default 50% HP).
 */
export function reviveHero(hero, options = {}) {
  const now = options.now ?? Date.now();
  const hpPercent = options.hpPercent ?? COMBAT_RESURRECT_HP_PERCENT;
  const fullHeal = options.fullHeal === true;
  const maxHp = Math.max(1, Math.floor(hero.maxHp ?? 100));
  const hp = fullHeal ? maxHp : Math.max(1, Math.floor(maxHp * hpPercent));

  return normalizeHeroCombatState(
    {
      ...hero,
      hp,
      maxHp,
      isDead: false,
      deathTime: null,
      shield: 0
    },
    { now, explicitRevive: true }
  );
}

/**
 * Apply auto-resurrection if enough time has passed since deathTime.
 */
export function tickAutoResurrection(hero, options = {}) {
  const now = options.now ?? Date.now();
  if (!hero.isDead || !hero.deathTime) {
    return { hero: { ...hero }, resurrected: false };
  }
  if (now - Number(hero.deathTime) < AUTO_RESURRECT_DELAY_MS) {
    return { hero: { ...hero }, resurrected: false };
  }
  return {
    hero: reviveHero(hero, { now, hpPercent: COMBAT_RESURRECT_HP_PERCENT }),
    resurrected: true
  };
}

/**
 * Merge combat normalization into a Firestore update payload.
 */
export function applyCombatStateToUpdate(oldHero, updateData, options = {}) {
  if (
    updateData.hp === undefined &&
    updateData.isDead === undefined &&
    updateData.deathTime === undefined &&
    updateData.shield === undefined
  ) {
    return updateData;
  }

  const explicitRevive = updateData.isDead === false;
  const merged = { ...oldHero, ...updateData };
  const normalized = normalizeHeroCombatState(merged, {
    now: options.now ?? Date.now(),
    explicitRevive
  });

  return {
    ...updateData,
    ...normalized
  };
}
