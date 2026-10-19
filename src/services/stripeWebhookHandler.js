import admin from 'firebase-admin';
import { TOKEN_PACKS } from '../data/tokenPacks.js';
import { TIER_LEVELS } from '../data/founderPacks.js';
import { grantFounderEntitlements, buildFounderHeroUpdate, applyAccountFounderToHero } from './cosmeticsService.js';
import { revokeFounderPurchase, revokeTokenPackPurchase } from './founderRevocation.js';

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 */
export async function handleStripeWebhookEvent(db, event) {
  const eventRef = db.collection('stripeEvents').doc(event.id);
  const existing = await eventRef.get();
  if (existing.exists && existing.data().processed) {
    return { duplicate: true, type: event.type };
  }

  if (event.type === 'checkout.session.completed') {
    await processCheckoutCompleted(db, event, eventRef);
    return { duplicate: false, type: event.type };
  }

  if (event.type === 'charge.refunded' || event.type === 'charge.dispute.created') {
    await processChargeReversal(db, event, eventRef);
    return { duplicate: false, type: event.type };
  }

  await eventRef.set(
    {
      type: event.type,
      processed: true,
      skipped: true,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
  return { duplicate: false, type: event.type, skipped: true };
}

async function processCheckoutCompleted(db, event, eventRef) {
  const session = event.data.object;
  const purchaseId = session.metadata?.purchaseId;
  if (!purchaseId) {
    throw new Error('No purchaseId in session metadata');
  }

  await db.runTransaction(async (tx) => {
    const purchaseRef = db.collection('purchases').doc(purchaseId);
    const purchaseDoc = await tx.get(purchaseRef);
    if (!purchaseDoc.exists) {
      throw new Error(`Purchase ${purchaseId} not found`);
    }
    const purchase = purchaseDoc.data();
    if (purchase.status === 'completed') {
      await eventRef.set(
        {
          type: event.type,
          purchaseId,
          processed: true,
          duplicatePurchase: true,
          processedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
      return;
    }

    const grants = [];

    if (purchase.packTier) {
      const tier = purchase.packTier;
      const tierLevel = TIER_LEVELS[tier] || 1;
      const accountUpdate = await grantFounderEntitlements(db, purchase.userId, tier);
      grants.push({ kind: 'founder', tier });

      const heroesSnap = await db.collection('heroes').where('twitchUserId', '==', purchase.userId).get();
      heroesSnap.docs.forEach((heroDoc) => {
        const hero = heroDoc.data();
        const heroUpdate = buildFounderHeroUpdate(hero, tier, tierLevel);
        tx.update(heroDoc.ref, heroUpdate);
      });
      grants.push({ kind: 'founder_heroes', count: heroesSnap.size });
    } else if (purchase.packType && purchase.heroId) {
      const packConfig = TOKEN_PACKS[purchase.packType];
      if (!packConfig) {
        throw new Error(`Unknown token pack ${purchase.packType}`);
      }
      const heroRef = db.collection('heroes').doc(purchase.heroId);
      const heroDoc = await tx.get(heroRef);
      if (!heroDoc.exists) {
        throw new Error(`Hero ${purchase.heroId} not found for token pack`);
      }
      const hero = heroDoc.data();
      tx.update(heroRef, {
        tokens: (hero.tokens || 0) + packConfig.tokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      grants.push({ kind: 'tokens', amount: packConfig.tokens, heroId: purchase.heroId });
    }

    tx.update(purchaseRef, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeSessionId: session.id,
      stripeEventId: event.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    tx.set(
      eventRef,
      {
        type: event.type,
        purchaseId,
        processed: true,
        grants,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });
}

async function processChargeReversal(db, event, eventRef) {
  const charge = event.data.object;
  const purchaseId = charge.metadata?.purchaseId;
  if (!purchaseId) {
    await eventRef.set(
      {
        type: event.type,
        processed: true,
        skipped: true,
        reason: 'no_purchase_metadata',
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return;
  }

  let purchaseToRevoke = null;
  await db.runTransaction(async (tx) => {
    const purchaseRef = db.collection('purchases').doc(purchaseId);
    const purchaseDoc = await tx.get(purchaseRef);
    if (!purchaseDoc.exists) return;
    const purchase = purchaseDoc.data();
    if (purchase.status === 'refunded') return;

    purchaseToRevoke = { id: purchaseId, ...purchase };

    tx.update(purchaseRef, {
      status: 'refunded',
      refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeEventId: event.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    tx.set(
      eventRef,
      {
        type: event.type,
        purchaseId,
        processed: true,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  });

  if (purchaseToRevoke) {
    if (purchaseToRevoke.packType && purchaseToRevoke.heroId) {
      await revokeTokenPackPurchase(db, purchaseToRevoke);
    }
    if (purchaseToRevoke.packTier) {
      await revokeFounderPurchase(db, purchaseToRevoke);
    }
  }
}

export { applyAccountFounderToHero };
