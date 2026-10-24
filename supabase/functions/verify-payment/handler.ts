import type { Database } from "../_shared/database.ts";
import type { Stripe } from "../_shared/stripe.ts";
import { database } from "../_shared/database.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { checkoutId, json, preflight, readBody } from "../_shared/http.ts";
import { fulfillPayment } from "../_shared/payments.ts";

export function createVerificationHandler(
  dependencies: () => { db: Database; stripe: Stripe } = () => ({
    db: database(),
    stripe: stripeClient(),
  }),
) {
  return async (req: Request) => {
    const origin = req.headers.get("origin");
    const early = preflight(req);
    if (early) return early;
    let body: Record<string, unknown>;
    try {
      body = await readBody(req);
    } catch {
      return json({ error: "Invalid request" }, 400, origin);
    }
    if (
      typeof body.stripeSessionId !== "string" ||
      !checkoutId.test(body.stripeSessionId)
    ) return json({ error: "Invalid Stripe session ID" }, 400, origin);
    try {
      const { db, stripe } = dependencies();
      const checkout = await stripe.checkout.sessions.retrieve(
        body.stripeSessionId,
      );
      if (
        checkout.payment_status !== "paid" &&
        checkout.payment_status !== "no_payment_required"
      ) return json({ error: "Payment not completed" }, 402, origin);
      const result = await fulfillPayment(db, checkout);
      // fulfill_checkout commits paid access and the durable outbox atomically.
      // Match webhook behavior: only the private worker waits on email delivery,
      // so a slow provider cannot turn an unlocked result into a browser timeout.
      return json(result, 200, origin);
    } catch {
      console.error("Payment could not be verified");
      return json({ error: "Unable to verify payment" }, 503, origin);
    }
  };
}
export const handler = createVerificationHandler();
