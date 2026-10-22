export const origins = new Set([
  "https://inner-code.me",
  "https://www.inner-code.me",
  "https://stripeiqtests.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
export const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const checkoutId = /^cs_(test|live)_[A-Za-z0-9]+$/;
export function json(
  body: unknown,
  status = 200,
  origin: string | null = null,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": origin && origins.has(origin)
        ? origin
        : "https://inner-code.me",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Vary": "Origin",
    },
  });
}
export function preflight(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && !origins.has(origin)) {
    return json({ error: "Origin is not allowed" }, 403, origin);
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: json(null, 200, origin).headers });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, origin);
  }
}
export async function readRaw(req: Request, limit = 16384): Promise<string> {
  if (!req.body) throw new Error("Missing body");
  const reader = req.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body = JSON.parse(await readRaw(req));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("Invalid body");
  }
  return body;
}
