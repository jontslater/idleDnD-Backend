const ENTRY_KEYS = new Set(['flip', 'scaleMultiplier', 'offsetY']);
const SCALE_MIN = 0.25;
const SCALE_MAX = 3;
const OFFSET_Y_MIN = -48;
const OFFSET_Y_MAX = 48;

export const EMPTY_SPRITE_OVERRIDES = {
  heroes: {},
  enemies: {},
  updatedAt: null,
  updatedBy: null,
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateEntry(spriteId, raw, bucket) {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `${bucket}["${spriteId}"] must be an object` };
  }

  for (const key of Object.keys(raw)) {
    if (!ENTRY_KEYS.has(key)) {
      return { ok: false, error: `${bucket}["${spriteId}"]: unknown field "${key}"` };
    }
  }

  if ('flip' in raw && typeof raw.flip !== 'boolean') {
    return { ok: false, error: `${bucket}["${spriteId}"].flip must be a boolean` };
  }

  if ('scaleMultiplier' in raw) {
    const scale = raw.scaleMultiplier;
    if (typeof scale !== 'number' || !Number.isFinite(scale)) {
      return { ok: false, error: `${bucket}["${spriteId}"].scaleMultiplier must be a number` };
    }
    if (scale < SCALE_MIN || scale > SCALE_MAX) {
      return {
        ok: false,
        error: `${bucket}["${spriteId}"].scaleMultiplier must be between ${SCALE_MIN} and ${SCALE_MAX}`,
      };
    }
  }

  if ('offsetY' in raw) {
    const offsetY = raw.offsetY;
    if (typeof offsetY !== 'number' || !Number.isFinite(offsetY)) {
      return { ok: false, error: `${bucket}["${spriteId}"].offsetY must be a number` };
    }
    if (offsetY < OFFSET_Y_MIN || offsetY > OFFSET_Y_MAX) {
      return {
        ok: false,
        error: `${bucket}["${spriteId}"].offsetY must be between ${OFFSET_Y_MIN} and ${OFFSET_Y_MAX}`,
      };
    }
  }

  return { ok: true };
}

function normalizeEntry(raw) {
  const out = {};
  if (raw.flip === true) out.flip = true;
  if (
    typeof raw.scaleMultiplier === 'number' &&
    Number.isFinite(raw.scaleMultiplier) &&
    raw.scaleMultiplier !== 1
  ) {
    out.scaleMultiplier = raw.scaleMultiplier;
  }
  if (
    typeof raw.offsetY === 'number' &&
    Number.isFinite(raw.offsetY) &&
    raw.offsetY !== 0
  ) {
    out.offsetY = raw.offsetY;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeBucket(bucketName, bucket) {
  if (!isPlainObject(bucket)) {
    return { ok: false, error: `"${bucketName}" must be an object` };
  }

  const sanitized = {};
  for (const [spriteId, entry] of Object.entries(bucket)) {
    if (!spriteId || typeof spriteId !== 'string') {
      return { ok: false, error: `${bucketName} keys must be non-empty sprite id strings` };
    }

    const validated = validateEntry(spriteId, entry, bucketName);
    if (!validated.ok) return validated;

    const normalized = normalizeEntry(entry);
    if (normalized) {
      sanitized[spriteId] = normalized;
    }
  }

  return { ok: true, value: sanitized };
}

/**
 * Validate PUT body for sprite overrides (heroes + enemies maps only).
 */
export function validateSpriteOverridesPayload(body) {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'Request body must be a JSON object' };
  }

  const extraKeys = Object.keys(body).filter((k) => k !== 'heroes' && k !== 'enemies');
  if (extraKeys.length) {
    return { ok: false, error: `Unexpected fields: ${extraKeys.join(', ')}` };
  }

  if (!('heroes' in body) || !('enemies' in body)) {
    return { ok: false, error: 'Both "heroes" and "enemies" are required' };
  }

  const heroesResult = sanitizeBucket('heroes', body.heroes);
  if (!heroesResult.ok) return heroesResult;

  const enemiesResult = sanitizeBucket('enemies', body.enemies);
  if (!enemiesResult.ok) return enemiesResult;

  return {
    ok: true,
    heroes: heroesResult.value,
    enemies: enemiesResult.value,
  };
}

export function firestoreTimestampToMillis(value) {
  if (value == null) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  return null;
}

export function documentToResponse(data) {
  if (!data) return { ...EMPTY_SPRITE_OVERRIDES };
  return {
    heroes: isPlainObject(data.heroes) ? data.heroes : {},
    enemies: isPlainObject(data.enemies) ? data.enemies : {},
    updatedAt: firestoreTimestampToMillis(data.updatedAt),
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null,
  };
}
