import { database } from "../_shared/database.ts";
import { stripeClient } from "../_shared/stripe.ts";
import { json, preflight, readBody, uuid } from "../_shared/http.ts";
import { createCheckout } from "../_shared/payments.ts";

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
  const { sessionId, accessToken, language } = body;
  if (
    typeof sessionId !== "string" || typeof accessToken !== "string" ||
    !uuid.test(sessionId) || !uuid.test(accessToken)
  ) {
    return json({ error: "Invalid session capability" }, 400, origin);
  }
  try {
    const url = await createCheckout(
      database(),
      stripeClient(),
      sessionId,
      accessToken,
      String(language),
      origin || "https://inner-code.me",
    );
    return json({ url }, 200, origin);
  } catch {
    console.error("Checkout could not be created");
    return json({ error: "Unable to create checkout session" }, 503, origin);
  }
}
