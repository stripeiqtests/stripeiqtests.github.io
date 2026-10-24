export interface Database {
  rpc<T>(name: string, body: Record<string, unknown>): Promise<T>;
  read<T>(table: string, query: string): Promise<T>;
}
export function database(): Database {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SERVICE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing database configuration");
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  async function request<T>(
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    // Database errors can contain private row values: do not forward/log them.
    if (!response.ok) {
      throw new Error(`Database request failed (${response.status})`);
    }
    const text = await response.text();
    return JSON.parse(text || "null");
  }
  return {
    rpc: (name, body) => request(`rpc/${name}`, body),
    read: (table, query) => request(`${table}?${query}`),
  };
}
