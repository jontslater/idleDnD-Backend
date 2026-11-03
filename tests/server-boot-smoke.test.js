import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

describe('server boot smoke', () => {
  let app;
  let savedMockEnv;
  let savedPeriodicEnv;

  before(async () => {
    savedMockEnv = process.env.USE_MOCK_FIRESTORE;
    savedPeriodicEnv = process.env.ENABLE_PERIODIC_UPDATES;
    process.env.USE_MOCK_FIRESTORE = '1';
    process.env.ENABLE_PERIODIC_UPDATES = 'false';

    const mod = await import('../src/index.js');
    app = mod.app;
    assert.ok(mod.db, 'expected db export after bootstrap');
  });

  after(() => {
    if (savedMockEnv === undefined) delete process.env.USE_MOCK_FIRESTORE;
    else process.env.USE_MOCK_FIRESTORE = savedMockEnv;
    if (savedPeriodicEnv === undefined) delete process.env.ENABLE_PERIODIC_UPDATES;
    else process.env.ENABLE_PERIODIC_UPDATES = savedPeriodicEnv;
  });

  it('imports src/index.js without Firestore circular init errors', () => {
    assert.equal(typeof app.use, 'function');
  });

  it('GET /api/config/sprite-overrides returns empty config', async () => {
    const server = await new Promise((resolve, reject) => {
      const s = app.listen(0, (err) => (err ? reject(err) : resolve(s)));
    });

    try {
      const { port } = server.address();
      const res = await fetch(`http://127.0.0.1:${port}/api/config/sprite-overrides`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body.heroes, {});
      assert.deepEqual(body.enemies, {});
      assert.equal(body.updatedAt, null);
      assert.equal(body.updatedBy, null);
    } finally {
      await new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
