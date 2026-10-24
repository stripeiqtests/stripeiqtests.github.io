import { database } from "../_shared/database.ts";
import type { Database } from "../_shared/database.ts";
import { Stripe, stripeClient } from "../_shared/stripe.ts";
import { fulfillPayment } from "../_shared/payments.ts";
import { readRaw } from "../_shared/http.ts";

export function createWebhookHandler(
  stripe: Stripe,
  db: Database,
  secret: string,
) {
  return async (req: Request) => {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }
    if (!secret) return new Response("Webhook not configured", { status: 503 });
    let event: Stripe.Event;
    try {
      const signature = req.headers.get("stripe-signature");
      if (!signature) throw new Error("Missing signature");
      const body = await readRaw(req, 262144);
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        secret,
        undefined,
        Stripe.createSubtleCryptoProvider(),
      );
    } catch {
      return new Response("Invalid signature", { status: 400 });
    }
    if (
      ![
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
      ].includes(event.type)
    ) return new Response("Ignored", { status: 200 });
    try {
      const checkout = await stripe.checkout.sessions.retrieve(
        (event.data.object as Stripe.Checkout.Session).id,
      );
      if (
        checkout.payment_status !== "paid" &&
        checkout.payment_status !== "no_payment_required"
      ) return new Response("Awaiting payment", { status: 200 });
      // Commit entitlement + durable outbox, then acknowledge promptly. The
      // private worker sends mail independently of Stripe's delivery timeout.
      await fulfillPayment(db, checkout);
      return new Response("Processed", { status: 200 });
    } catch {
      console.error("Webhook fulfillment failed; Stripe should retry");
      return new Response("Please retry", { status: 503 });
    }
  };
}
export async function handler(req: Request) {
  try {
    return await createWebhookHandler(
      stripeClient(),
      database(),
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || "",
    )(req);
  } catch {
    return new Response("Webhook not configured", { status: 503 });
  }
}
