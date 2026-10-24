import type { Stripe } from "./stripe.ts";
import type { Database } from "./database.ts";
import { checkoutId, uuid } from "./http.ts";

export interface Order {
  id: string;
  session_id: string;
  test_id: string;
  title: string;
  expected_amount: number;
  currency: "usd";
  language: "ru" | "en";
  return_origin: string;
  stripe_checkout_id: string | null;
  expires_at: string;
  email: string | null;
}
export interface Fulfillment {
  success: true;
  testSessionId: string;
  testId: string;
  amountPaid: number;
  resultAccessToken: string;
  alreadyProcessed: boolean;
}
// Values must come from Stripe's server API, never an unsigned browser/event.
export function paymentFacts(checkout: Stripe.Checkout.Session) {
  const m = checkout.metadata;
  const expected = Number(m?.expectedAmount);
  const subtotal = checkout.amount_subtotal, total = checkout.amount_total;
  const discount = checkout.total_details?.amount_discount ?? 0;
  if (
    !checkoutId.test(checkout.id) || checkout.mode !== "payment" ||
    checkout.status !== "complete" ||
    checkout.currency !== "usd" || !m || !uuid.test(m.testSessionId || "") ||
    !uuid.test(m.testId || "") ||
    !/^\d+$/.test(m.expectedAmount || "") || !Number.isSafeInteger(expected) ||
    expected < 50 || expected > 100000 ||
    !Number.isSafeInteger(subtotal) || !Number.isSafeInteger(total) ||
    subtotal !== expected ||
    total === null || total < 0 || total > subtotal ||
    !Number.isSafeInteger(discount) || discount < 0 ||
    discount !== subtotal - total ||
    (checkout.total_details?.amount_tax ?? 0) !== 0 ||
    (checkout.total_details?.amount_shipping ?? 0) !== 0 ||
    !(checkout.payment_status === "paid" ||
      (checkout.payment_status === "no_payment_required" && total === 0)) ||
    (m.orderId !== undefined && !uuid.test(m.orderId))
  ) throw new Error("Invalid payment facts");
  return {
    orderId: m.orderId || null,
    sessionId: m.testSessionId,
    testId: m.testId,
    expected,
    total,
    language: m.language === "en" ? "en" : "ru",
  };
}
export async function fulfillPayment(
  db: Database,
  checkout: Stripe.Checkout.Session,
): Promise<Fulfillment> {
  const facts = paymentFacts(checkout);
  if (facts.orderId === null) {
    // Old verification sent mail directly without an outbox record. Preserve
    // its already-paid behavior instead of enqueueing a second historical copy
    // when a user revisits a pre-upgrade Checkout return URL.
    const [legacy] = await db.read<{
      test_id: string;
      is_paid: boolean;
      stripe_session_id: string | null;
      access_token: string;
    }[]>(
      "test_sessions",
      `id=eq.${facts.sessionId}&select=test_id,is_paid,stripe_session_id,access_token&limit=1`,
    );
    if (legacy?.is_paid) {
      if (
        legacy.test_id !== facts.testId ||
        legacy.stripe_session_id !== checkout.id ||
        !uuid.test(legacy.access_token)
      ) {
        throw new Error("Legacy payment mismatch");
      }
      return {
        success: true,
        testSessionId: facts.sessionId,
        testId: facts.testId,
        amountPaid: facts.total,
        resultAccessToken: legacy.access_token,
        alreadyProcessed: true,
      };
    }
  }
  return await db.rpc<Fulfillment>("fulfill_checkout", {
    p_order_id: facts.orderId,
    p_session_id: facts.sessionId,
    p_test_id: facts.testId,
    p_checkout_id: checkout.id,
    p_expected_amount: facts.expected,
    p_amount_paid: facts.total,
    p_language: facts.language,
  });
}
export async function createCheckout(
  db: Database,
  stripe: Stripe,
  sessionId: string,
  accessToken: string,
  language: string,
  origin: string,
  retried = false,
): Promise<string> {
  const order = await db.rpc<Order>("prepare_checkout", {
    p_session_id: sessionId,
    p_access_token: accessToken,
    p_language: language === "en" ? "en" : "ru",
    p_origin: origin,
  });
  const checkout = order.stripe_checkout_id
    ? await stripe.checkout.sessions.retrieve(order.stripe_checkout_id)
    : await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        price_data: {
          currency: order.currency,
          product_data: {
            name: order.title,
            description: order.language === "ru"
              ? "Подробный результат теста"
              : "Detailed test results",
          },
          unit_amount: order.expected_amount,
        },
        quantity: 1,
      }],
      success_url:
        `${order.return_origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `${order.return_origin}/payment/cancel?session_id=${order.session_id}`,
      customer_email: order.email || undefined,
      allow_promotion_codes: true,
      metadata: {
        orderId: order.id,
        testSessionId: order.session_id,
        testId: order.test_id,
        expectedAmount: String(order.expected_amount),
        language: order.language,
      },
    }, { idempotencyKey: `inner-code-order-${order.id}` });
  if (checkout.status === "expired" && !retried) {
    await db.rpc("expire_checkout", {
      p_order_id: order.id,
      p_checkout_id: checkout.id,
    });
    return await createCheckout(
      db,
      stripe,
      sessionId,
      accessToken,
      language,
      origin,
      true,
    );
  }
  if (!checkout.url || checkout.status !== "open") {
    throw new Error("Checkout unavailable");
  }
  await db.rpc("attach_checkout", {
    p_order_id: order.id,
    p_checkout_id: checkout.id,
  });
  return checkout.url;
}
