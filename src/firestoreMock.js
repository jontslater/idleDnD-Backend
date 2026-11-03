/**
 * In-memory Firestore stub for boot smoke tests (USE_MOCK_FIRESTORE=1).
 */
export function createInMemoryFirestore() {
  const documents = new Map();

  function docRef(collectionName, docId) {
    const key = `${collectionName}/${docId}`;
    return {
      async get() {
        if (!documents.has(key)) {
          return { exists: false, data: () => undefined };
        }
        const data = documents.get(key);
        return { exists: true, data: () => data };
      },
      async set(data, _options) {
        documents.set(key, { ...data });
      },
    };
  }

  return {
    collection(collectionName) {
      return {
        doc(docId) {
          return docRef(collectionName, docId);
        },
      };
    },
    batch() {
      const ops = [];
      return {
        update(ref, data) {
          ops.push({ ref, data, type: 'update' });
        },
        commit: async () => {},
      };
    },
  };
}
