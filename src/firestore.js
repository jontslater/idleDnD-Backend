/** Firestore singleton set during app bootstrap (avoids circular imports from routes). */
let firestoreDb = null;

export function initFirestore(db) {
  firestoreDb = db;
}

export function getFirestore() {
  if (!firestoreDb) {
    throw new Error('Firestore has not been initialized');
  }
  return firestoreDb;
}
