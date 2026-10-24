// Separate rollout endpoint keeps the deployed legacy direct mailer intact.
import { handler } from "../send-results-email/handler.ts";
Deno.serve(handler);
