/**
 * Resolve purchaseId/userId from Stripe charge or dispute payloads.
 * Disputes do not copy session metadata — follow payment_intent when present.
 */

export async function resolvePurchaseFromStripeObject(db, stripeObject, fetchPaymentIntent) {
  const charge =
    stripeObject.object === 'charge'
      ? stripeObject
      : stripeObject.charge && typeof stripeObject.charge === 'object'
        ? stripeObject.charge
        : null;

  let purchaseId = charge?.metadata?.purchaseId || stripeObject.metadata?.purchaseId;
  let userId = charge?.metadata?.userId || stripeObject.metadata?.userId;
  const amount = charge?.amount ?? stripeObject.amount ?? null;
  const amountRefunded = charge?.amount_refunded ?? stripeObject.amount_refunded ?? 0;

  const paymentIntentId =
    stripeObject.payment_intent ||
    charge?.payment_intent ||
    (typeof stripeObject.charge === 'object' ? stripeObject.charge.payment_intent : null);

  if (!purchaseId && paymentIntentId) {
    const cached = await db.collection('stripePaymentIntents').doc(String(paymentIntentId)).get();
    if (cached.exists) {
      const data = cached.data();
      purchaseId = data.purchaseId;
      userId = data.userId;
    } else if (fetchPaymentIntent) {
      const pi = await fetchPaymentIntent(paymentIntentId);
      purchaseId = pi?.metadata?.purchaseId;
      userId = pi?.metadata?.userId;
    }
  }

  if (!purchaseId && stripeObject.id && !charge) {
    const byDispute = await db
      .collection('purchases')
      .where('stripeDisputeId', '==', stripeObject.id)
      .limit(1)
      .get();
    if (!byDispute.empty) {
      const doc = byDispute.docs[0];
      return { purchaseId: doc.id, userId: doc.data().userId, amount, amountRefunded, purchase: doc.data() };
    }
  }

  return { purchaseId, userId, amount, amountRefunded };
}

export function isFullRefund(amount, amountRefunded) {
  if (!amount || amount <= 0) return true;
  return amountRefunded >= amount;
}

export function refundFraction(amount, amountRefunded) {
  if (!amount || amount <= 0) return 1;
  return Math.min(1, Math.max(0, amountRefunded / amount));
}
