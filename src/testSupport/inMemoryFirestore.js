/**
 * Minimal in-memory Firestore fake for tests.
 * Supports collection/doc/where/limit/get/set/update used by auth middleware.
 */

import { assertNoServerTimestampInsideArrays } from './firestoreFieldGuards.js';

function applyDotNotation(merged, updates) {
  for (const [key, val] of Object.entries(updates)) {
    if (!key.includes('.')) continue;
    const parts = key.split('.');
    let cursor = merged;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (cursor[part] == null || typeof cursor[part] !== 'object' || Array.isArray(cursor[part])) {
        cursor[part] = {};
      }
      cursor = cursor[part];
    }
    const leaf = parts[parts.length - 1];
    if (val && typeof val === 'object' && val._methodName === 'delete') {
      delete cursor[leaf];
    } else {
      cursor[leaf] = cloneData(val);
    }
    delete merged[key];
  }
}

function cloneData(data) {
  if (data == null) return data;
  if (typeof data.toMillis === 'function') return data;
  if (Array.isArray(data)) return data.map(cloneData);
  if (typeof data === 'object') {
    const out = {};
    for (const [key, value] of Object.entries(data)) {
      out[key] = cloneData(value);
    }
    return out;
  }
  return data;
}

export function createInMemoryFirestore(initialData = {}) {
  const collections = new Map();

  function ensureCollection(name) {
    if (!collections.has(name)) {
      collections.set(name, new Map());
    }
    return collections.get(name);
  }

  for (const [collName, docs] of Object.entries(initialData)) {
    const coll = ensureCollection(collName);
    for (const [id, data] of Object.entries(docs)) {
      coll.set(id, cloneData(data));
    }
  }

  function docSnapshot(collName, id) {
    const coll = ensureCollection(collName);
    const data = coll.get(id);
    const ref = makeDocRef(collName, id);
    return {
      exists: data !== undefined,
      id,
      data: () => cloneData(data),
      ref
    };
  }

  function makeDocRef(collName, id) {
    return {
      id,
      get: async () => docSnapshot(collName, id),
      set: async (data) => {
        assertNoServerTimestampInsideArrays(data);
        ensureCollection(collName).set(id, cloneData(data));
      },
      update: async (updates) => {
        assertNoServerTimestampInsideArrays(updates);
        const coll = ensureCollection(collName);
        const existing = coll.get(id) || {};
        const merged = { ...existing, ...cloneData(updates) };
        applyDotNotation(merged, updates);
        for (const [key, val] of Object.entries(updates)) {
          if (val && typeof val === 'object' && val._methodName === 'delete') {
            delete merged[key];
          }
        }
        coll.set(id, merged);
      },
      delete: async () => {
        ensureCollection(collName).delete(id);
      }
    };
  }

  function runQuery(collName, filters, limitN) {
    const coll = ensureCollection(collName);
    let entries = [...coll.entries()];
    for (const { field, op, value } of filters) {
      if (op !== '==') {
        throw new Error(`Unsupported op: ${op}`);
      }
      entries = entries.filter(([, data]) => data[field] === value);
    }
    if (limitN !== undefined) {
      entries = entries.slice(0, limitN);
    }
    return entries.map(([id, data]) => ({
      id,
      data: () => cloneData(data),
      ref: makeDocRef(collName, id)
    }));
  }

  function makeQuery(collName, filters = []) {
    let limitN;
    const query = {
      where(field, op, value) {
        return makeQuery(collName, [...filters, { field, op, value }]);
      },
      limit(n) {
        limitN = n;
        return query;
      },
      get: async () => {
        const docs = runQuery(collName, filters, limitN);
        return { empty: docs.length === 0, docs };
      }
    };
    return query;
  }

  async function runTransaction(updateFn) {
    // Naive single-threaded transaction for tests
    const tx = {
      async get(ref) {
        return ref.get();
      },
      update(ref, data) {
        return ref.update(data);
      },
      set(ref, data) {
        return ref.set(data);
      },
      delete(ref) {
        return ref.delete();
      }
    };
    return updateFn(tx);
  }

  return {
    runTransaction,
    collection(name) {
      return {
        doc(id) {
          return makeDocRef(name, id);
        },
        get: async () => {
          const coll = ensureCollection(name);
          const docs = [...coll.entries()].map(([id, data]) => ({
            id,
            data: () => cloneData(data),
            ref: makeDocRef(name, id)
          }));
          return { empty: docs.length === 0, docs };
        },
        where(field, op, value) {
          return makeQuery(name, [{ field, op, value }]);
        },
        add: async (data) => {
          const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const ref = makeDocRef(name, id);
          await ref.set(data);
          return ref;
        }
      };
    },
    batch() {
      const ops = [];
      return {
        set(ref, data, _options) {
          ops.push(() => ref.set(data));
          return this;
        },
        update(ref, data) {
          ops.push(() => ref.update(data));
          return this;
        },
        delete(ref) {
          ops.push(() => ref.delete());
          return this;
        },
        commit: async () => {
          for (const op of ops) {
            await op();
          }
        }
      };
    },
    _collections: collections
  };
}
