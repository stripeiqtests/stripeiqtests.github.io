import type { Database } from "./database.ts";

interface Job {
  id: string;
  session_id: string;
  title: string;
  language: "ru" | "en";
  lease_id: string;
  payload: EmailPayload | null;
}
interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}
interface Result {
  id: string;
  email: string;
  access_token: string;
  is_paid: boolean;
  overall_score: number;
  analyst_score: number;
  strategist_score: number;
  observer_score: number;
  intuitive_score: number;
}
export function escapeHtml(text: string): string {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(
    ">",
    "&gt;",
  ).replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
export function renderEmail(
  job: Pick<Job, "title" | "language">,
  s: Result,
  support: string,
): EmailPayload {
  const ru = job.language === "ru";
  const link =
    `https://inner-code.me/results/${s.id}#access_token=${s.access_token}`;
  const labels = ru
    ? ["Аналитик", "Стратег", "Наблюдатель", "Интуит"]
    : ["Analyst", "Strategist", "Observer", "Intuitive"];
  const scores = [
    s.analyst_score,
    s.strategist_score,
    s.observer_score,
    s.intuitive_score,
  ].map((v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0))));
  const overall = Math.max(
    0,
    Math.min(100, Math.round(Number(s.overall_score) || 0)),
  );
  const heading = ru ? "Результаты теста" : "Your test results";
  const explanation = ru
    ? "Общий результат — среднее четырёх показателей этой попытки. Это не измерение IQ и не сравнение с другими людьми."
    : "The overall result is the average of this attempt’s four dimension scores, not an IQ measurement or a comparison with other people.";
  const privacy = ru
    ? "Сохраните личную ссылку. Любой, у кого она есть, сможет открыть результат."
    : "Save your personal link. Anyone with this link can open your result.";
  const text = `${heading}: ${job.title}\n${
    ru ? "Общий результат" : "Overall result"
  }: ${overall}%\n${
    labels.map((label, i) => `${label}: ${scores[i]}%`).join("\n")
  }\n\n${explanation}\n\n${privacy}\n${link}\n\n${
    ru ? "Поддержка" : "Support"
  }: ${support}`;
  return {
    from: "Inner Code <noreply@inner-code.me>",
    to: [s.email],
    subject: `${heading} — ${job.title}`,
    text,
    html:
      `<!doctype html><html lang="${job.language}"><meta charset="utf-8"><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:600px;margin:auto;padding:24px"><h1>${heading}</h1><h2>${
        escapeHtml(job.title)
      }</h2><p style="font-size:28px">${
        ru ? "Общий результат" : "Overall result"
      }: <strong>${overall}%</strong></p><ul>${
        labels.map((label, i) => `<li>${label}: ${scores[i]}%</li>`).join("")
      }</ul><p>${explanation}</p><p><a href="${escapeHtml(link)}">${
        ru ? "Открыть подробный результат" : "Open detailed results"
      }</a></p><p>${privacy}</p><p>${ru ? "Поддержка" : "Support"}: ${
        escapeHtml(support)
      }</p></body></html>`,
  };
}
export async function deliverEmails(
  db: Database,
  sessionId: string | null = null,
  transport: typeof fetch = fetch,
) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("Email provider not configured");
  let sent = 0, processed = 0;
  const deadline = Date.now() + 45000;
  // Claim immediately before sending, so waiting jobs do not consume leases
  // while a previous provider/database call is slow.
  for (let i = 0; i < (sessionId ? 1 : 5) && Date.now() < deadline; i++) {
    const [job] = await db.rpc<Job[]>("claim_result_emails", {
      p_session_id: sessionId,
      p_limit: 1,
    });
    if (!job) break;
    processed++;
    let providerId: string | null = null;
    let error: string | null = null;
    try {
      let payload = job.payload;
      if (!payload) {
        const [s] = await db.read<Result[]>(
          "test_sessions",
          `id=eq.${job.session_id}&select=id,email,access_token,is_paid,overall_score,analyst_score,strategist_score,observer_score,intuitive_score`,
        );
        if (!s?.is_paid || !s.email) throw new Error("Missing paid recipient");
        const settings = await db.read<{ value: string }[]>(
          "app_settings",
          "key=eq.support_contact&select=value",
        );
        // Freeze recipient, subject, scores and link before the first provider
        // request so retries use identical bodies with the same idempotency key.
        payload = await db.rpc<EmailPayload>("set_result_email_payload", {
          p_id: job.id,
          p_lease_id: job.lease_id,
          p_payload: renderEmail(
            job,
            s,
            settings[0]?.value || "stripeiqtests@proton.me",
          ),
        });
      }
      const response = await transport("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `result-email/${job.id}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`provider_http_${response.status}`);
      const result = await response.json();
      if (typeof result.id !== "string" || !result.id) {
        throw new Error("provider_invalid_response");
      }
      providerId = result.id;
    } catch (e) {
      // Only controlled codes are stored; provider/DB bodies and addresses stay private.
      error = e instanceof Error && /^provider_http_\d+$/.test(e.message)
        ? e.message
        : "delivery_unconfirmed";
    }
    const finished = await db.rpc<boolean>("finish_result_email", {
      p_id: job.id,
      p_lease_id: job.lease_id,
      p_provider_id: providerId,
      p_error: error,
    });
    if (finished && providerId) sent++;
  }
  return { processed, sent };
}
