import { database } from "../_shared/database.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { checkoutId, json, preflight, readBody } from "../_shared/http.ts";
import { fulfillPayment } from "../_shared/payments.ts";
import { deliverEmails } from "../_shared/email.ts";

export async function handler(req: Request) {
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
    const db = database();
    const checkout = await stripeClient().checkout.sessions.retrieve(
      body.stripeSessionId,
    );
    if (
      checkout.payment_status !== "paid" &&
      checkout.payment_status !== "no_payment_required"
    ) return json({ error: "Payment not completed" }, 402, origin);
    const result = await fulfillPayment(db, checkout);
    // A delivery failure never rolls back a paid entitlement.
    await deliverEmails(db, result.testSessionId).catch(() =>
      console.error("Result email remains queued")
    );
    return json(result, 200, origin);
  } catch {
    console.error("Payment could not be verified");
    return json({ error: "Unable to verify payment" }, 503, origin);
  }
}
if (import.meta.main) Deno.serve(handler);
