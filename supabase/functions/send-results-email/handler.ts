import { database } from "../_shared/database.ts";
import { deliverEmails } from "../_shared/email.ts";
import { json, readBody, uuid } from "../_shared/http.ts";

export async function handler(req: Request) {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const serviceKey = Deno.env.get("SERVICE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const workerKey = Deno.env.get("RESULT_EMAIL_WORKER_SECRET");
  const authorization = req.headers.get("authorization");
  if (
    (!serviceKey || authorization !== `Bearer ${serviceKey}`) &&
    (!workerKey || authorization !== `Bearer ${workerKey}`)
  ) {
    return json({ error: "Forbidden" }, 403);
  }
  try {
    const body = await readBody(req);
    if (
      body.sessionId !== undefined &&
      (typeof body.sessionId !== "string" || !uuid.test(body.sessionId))
    ) return json({ error: "Invalid session" }, 400);
    return json(
      await deliverEmails(
        database(),
        typeof body.sessionId === "string" ? body.sessionId : null,
      ),
    );
  } catch {
    console.error("Email worker failed; pending jobs retained");
    return json({ error: "Unable to process queued email" }, 503);
  }
}
