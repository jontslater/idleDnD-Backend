import { db } from '../index.js';

/**
 * Resolve a hero by Firestore document id (canonical for all quest APIs).
 */
export async function resolveHeroByDocId(heroId) {
  if (!heroId || typeof heroId !== 'string') {
    return null;
  }

  const heroDoc = await db.collection('heroes').doc(heroId).get();
  if (!heroDoc.exists) {
    return null;
  }

  return {
    id: heroDoc.id,
    ref: heroDoc.ref,
    data: heroDoc.data()
  };
}
