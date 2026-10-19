import admin from 'firebase-admin';
import { TOKEN_PACKS } from '../data/tokenPacks.js';
import { TIER_LEVELS } from '../data/founderPacks.js';
import { grantFounderEntitlements, buildFounderHeroUpdate } from './cosmeticsService.js';
import { revokeFounderPurchase, revokeTokenPackPurchase } from './founderRevocation.js';
import {
  resolvePurchaseFromStripeObject,
  isFullRefund,
  refundFraction
} from '../utils/stripePurchaseMetadata.js';

const DISPUTE_EVENTS = new Set([
  'charge.dispute.created',
  'charge.dispute.updated',
  'charge.dispute.closed',
  'charge.dispute.funds_withdrawn'
]);

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 * @param {{ stripe?: import('stripe').Stripe }} [deps]
 */
export async function handleStripeWebhookEvent(db, event, deps = {}) {
  const eventRef = db.collection('stripeEvents').doc(event.id);
  const existing = await eventRef.get();
  if (existing.exists && existing.data().processed) {
    return { duplicate: true, type: event.type };
  }

  if (event.type === 'checkout.session.completed') {
    await processCheckoutCompleted(db, event, eventRef);
    return { duplicate: false, type: event.type };
  }

  if (event.type === 'charge.refunded' || DISPUTE_EVENTS.has(event.type)) {
    await processChargeReversal(db, event, eventRef, deps);
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

async function fetchPaymentIntentMetadata(stripe, paymentIntentId) {
  if (!stripe || !paymentIntentId) return null;
  const pi = await stripe.paymentIntents.retrieve(String(paymentIntentId));
  return pi?.metadata || null;
}

async function processCheckoutCompleted(db, event, eventRef) {
  const session = event.data.object;
  const purchaseId = session.metadata?.purchaseId;
  if (!purchaseId) {
    throw new Error('No purchaseId in session metadata');
  }

  const paymentIntentId = session.payment_intent;
  if (paymentIntentId) {
    await db
      .collection('stripePaymentIntents')
      .doc(String(paymentIntentId))
      .set(
        {
          purchaseId,
          userId: session.metadata?.userId || '',
          amount: session.amount_total || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
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
      await grantFounderEntitlements(db, purchase.userId, tier);
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
        tokenBalanceBlocked: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      grants.push({ kind: 'tokens', amount: packConfig.tokens, heroId: purchase.heroId });
    }

    tx.update(purchaseRef, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId || null,
      amountPaid: session.amount_total || purchase.amountPaid || null,
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

async function processChargeReversal(db, event, eventRef, deps) {
  const object = event.data.object;
  const fetchPi = deps.stripe
    ? (id) => fetchPaymentIntentMetadata(deps.stripe, id)
    : null;

  let chargeObject = object;
  if (DISPUTE_EVENTS.has(event.type) && object.charge && typeof object.charge === 'string' && deps.stripe) {
    chargeObject = await deps.stripe.charges.retrieve(object.charge);
  }

  const meta = await resolvePurchaseFromStripeObject(db, chargeObject, fetchPi);
  const purchaseId = meta.purchaseId;
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

  const purchaseRef = db.collection('purchases').doc(purchaseId);
  const purchaseDoc = await purchaseRef.get();
  if (!purchaseDoc.exists) return;
  const purchase = { id: purchaseId, ...purchaseDoc.data() };
  if (purchase.status === 'refunded') {
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

  const amount = meta.amount ?? purchase.amountPaid ?? chargeObject.amount ?? 0;
  const amountRefunded =
    meta.amountRefunded ??
    chargeObject.amount_refunded ??
    (DISPUTE_EVENTS.has(event.type) ? amount : 0);

  const fraction = refundFraction(amount, amountRefunded);
  const full = isFullRefund(amount, amountRefunded);

  if (purchase.packTier && !full) {
    await eventRef.set(
      {
        type: event.type,
        purchaseId,
        processed: true,
        skipped: true,
        reason: 'partial_founder_refund_manual_review',
        amount,
        amountRefunded,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    return;
  }

  const revocation = [];
  try {
    if (purchase.packTier) {
      await revokeFounderPurchase(db, purchase);
      revocation.push({ kind: 'founder_revoked' });
    }
    if (purchase.packType && purchase.heroId) {
      const result = await revokeTokenPackPurchase(db, purchase, fraction);
      revocation.push({ kind: 'tokens_revoked', ...result });
    }
  } catch (err) {
    await eventRef.set(
      {
        type: event.type,
        purchaseId,
        processed: false,
        revocationError: String(err.message || err),
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    throw err;
  }

  await purchaseRef.update({
    status: 'refunded',
    refundedAt: admin.firestore.FieldValue.serverTimestamp(),
    refundFraction: fraction,
    stripeEventId: event.id,
    ...(DISPUTE_EVENTS.has(event.type) ? { stripeDisputeId: object.id } : {}),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await eventRef.set(
    {
      type: event.type,
      purchaseId,
      processed: true,
      revocation,
      amountRefunded,
      processedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}
