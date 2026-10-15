/**
 * Minimal in-memory Firestore fake for tests.
 * Supports collection/doc/where/limit/get/set/update used by auth middleware.
 */

function cloneData(data) {
  return data ? JSON.parse(JSON.stringify(data)) : data;
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
      get: async () => docSnapshot(collName, id),
      set: async (data) => {
        ensureCollection(collName).set(id, cloneData(data));
      },
      update: async (updates) => {
        const coll = ensureCollection(collName);
        const existing = coll.get(id) || {};
        coll.set(id, { ...existing, ...cloneData(updates) });
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

  return {
    collection(name) {
      return {
        doc(id) {
          return makeDocRef(name, id);
        },
        where(field, op, value) {
          return makeQuery(name, [{ field, op, value }]);
        },
        add: async (data) => {
          const id = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          await makeDocRef(name, id).set(data);
          return { id };
        }
      };
    },
    batch() {
      const ops = [];
      return {
        update(ref, data) {
          ops.push(() => ref.update(data));
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
