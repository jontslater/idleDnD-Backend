import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSpriteOverrideAdminLogins,
  isSpriteOverrideAdmin,
  requireSpriteOverrideAdmin,
} from '../src/utils/spriteOverrideAdmin.js';
import {
  validateSpriteOverridesPayload,
  documentToResponse,
  firestoreTimestampToMillis,
} from '../src/utils/spriteOverridesValidation.js';

describe('spriteOverrideAdmin', () => {
  const originalEnv = process.env.SPRITE_OVERRIDE_ADMIN_LOGINS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.SPRITE_OVERRIDE_ADMIN_LOGINS;
    } else {
      process.env.SPRITE_OVERRIDE_ADMIN_LOGINS = originalEnv;
    }
  });

  it('allows default admin logins (case insensitive)', () => {
    assert.equal(isSpriteOverrideAdmin({ twitchUsername: 'tehchno' }), true);
    assert.equal(isSpriteOverrideAdmin({ twitchUsername: 'TehChNo' }), true);
    assert.equal(isSpriteOverrideAdmin({ twitchUsername: 'theneverendingwar' }), true);
    assert.equal(isSpriteOverrideAdmin({ twitchUsername: 'viewer123' }), false);
  });

  it('falls back to displayName when twitchUsername missing', () => {
    assert.equal(isSpriteOverrideAdmin({ displayName: 'tehchno' }), true);
  });

  it('honors SPRITE_OVERRIDE_ADMIN_LOGINS env override', () => {
    process.env.SPRITE_OVERRIDE_ADMIN_LOGINS = 'CustomAdmin, OtherOne';
    const logins = getSpriteOverrideAdminLogins();
    assert.equal(logins.has('customadmin'), true);
    assert.equal(logins.has('otherone'), true);
    assert.equal(isSpriteOverrideAdmin({ twitchUsername: 'tehchno' }), false);
    assert.equal(isSpriteOverrideAdmin({ twitchUsername: 'CustomAdmin' }), true);
  });

  it('requireSpriteOverrideAdmin returns 403 for non-admins', () => {
    let statusCode;
    let body;
    const req = { user: { twitchUsername: 'notadmin' } };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        body = payload;
      },
    };
    let nextCalled = false;
    requireSpriteOverrideAdmin(req, res, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, false);
    assert.equal(statusCode, 403);
    assert.match(body.error, /admin/i);
  });

  it('requireSpriteOverrideAdmin calls next for admins', () => {
    let nextCalled = false;
    requireSpriteOverrideAdmin({ user: { twitchUsername: 'tehchno' } }, {}, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });
});

describe('validateSpriteOverridesPayload', () => {
  it('accepts valid heroes and enemies maps', () => {
    const result = validateSpriteOverridesPayload({
      heroes: {
        mage: { flip: true, scaleMultiplier: 1.05, offsetY: 2 },
      },
      enemies: {
        'Masked Orc': { offsetY: -3 },
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.heroes, {
      mage: { flip: true, scaleMultiplier: 1.05, offsetY: 2 },
    });
    assert.deepEqual(result.enemies, {
      'Masked Orc': { offsetY: -3 },
    });
  });

  it('strips default scale and zero offset', () => {
    const result = validateSpriteOverridesPayload({
      heroes: { bard: { scaleMultiplier: 1, offsetY: 0, flip: false } },
      enemies: {},
    });
    assert.equal(result.ok, true);
    assert.deepEqual(result.heroes, {});
  });

  it('rejects missing heroes or enemies', () => {
    assert.equal(validateSpriteOverridesPayload({ heroes: {} }).ok, false);
    assert.equal(validateSpriteOverridesPayload({ enemies: {} }).ok, false);
  });

  it('rejects scaleMultiplier outside 0.25-3', () => {
    const low = validateSpriteOverridesPayload({
      heroes: { x: { scaleMultiplier: 0.1 } },
      enemies: {},
    });
    assert.equal(low.ok, false);
    assert.match(low.error, /scaleMultiplier/);

    const high = validateSpriteOverridesPayload({
      heroes: { x: { scaleMultiplier: 3.5 } },
      enemies: {},
    });
    assert.equal(high.ok, false);
  });

  it('rejects offsetY outside -48..48', () => {
    const result = validateSpriteOverridesPayload({
      heroes: {},
      enemies: { orc: { offsetY: 50 } },
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /offsetY/);
  });

  it('rejects unknown entry fields', () => {
    const result = validateSpriteOverridesPayload({
      heroes: { mage: { yOffset: 1 } },
      enemies: {},
    });
    assert.equal(result.ok, false);
    assert.match(result.error, /unknown field/);
  });
});

describe('documentToResponse', () => {
  it('maps Firestore timestamps to millis', () => {
    const millis = firestoreTimestampToMillis({ toMillis: () => 1234567890 });
    assert.equal(millis, 1234567890);
    const doc = documentToResponse({
      heroes: { a: { flip: true } },
      enemies: {},
      updatedAt: { toMillis: () => 999 },
      updatedBy: 'tehchno',
    });
    assert.equal(doc.updatedAt, 999);
    assert.equal(doc.updatedBy, 'tehchno');
  });
});
