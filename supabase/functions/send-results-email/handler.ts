import { database } from "../_shared/database.ts";
import type { Database } from "../_shared/database.ts";
import { deliverEmails } from "../_shared/email.ts";
import { json, readBody, uuid } from "../_shared/http.ts";
import { validPresentation } from "../_shared/presentation.ts";

export function createEmailHandler(getDatabase: () => Database = database) {
  return async function handler(req: Request) {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }
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
      const db = getDatabase();
      // Private release preflight. No claim RPC, result read, send or write occurs.
      if (body.dryRun === true) {
        if (body.sessionId !== undefined) {
          return json({ error: "Invalid preflight" }, 400);
        }
        const [pending, settings] = await Promise.all([
          db.read<{ id: string }[]>(
            "result_email_outbox",
            "select=id&state=in.(pending,sending)&limit=1",
          ),
          db.read<{ key: string; value: string }[]>(
            "app_settings",
            "key=eq.result_presentation&select=key,value",
          ),
          db.read("archetype_results", "select=dimension&limit=1"),
        ]);
        const configured = settings[0]?.value;
        if (configured && !validPresentation(JSON.parse(configured))) {
          throw new Error("Invalid presentation configuration");
        }
        const ready = Boolean(Deno.env.get("RESEND_API_KEY"));
        return json({
          protocol: "outbox-v1",
          ready,
          hasPendingJobs: pending.length > 0,
        }, ready ? 200 : 503);
      }
      if (
        body.sessionId !== undefined &&
        (typeof body.sessionId !== "string" || !uuid.test(body.sessionId))
      ) return json({ error: "Invalid session" }, 400);
      return json(
        await deliverEmails(
          db,
          typeof body.sessionId === "string" ? body.sessionId : null,
        ),
      );
    } catch {
      console.error("Email worker failed; pending jobs retained");
      return json({ error: "Unable to process queued email" }, 503);
    }
  };
}
export const handler = createEmailHandler();
