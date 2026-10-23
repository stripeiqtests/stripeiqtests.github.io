import assert from "node:assert/strict";
import { Stripe } from "../_shared/stripe.ts";
import {
  createCheckout,
  fulfillPayment,
  paymentFacts,
} from "../_shared/payments.ts";
import type { Database } from "../_shared/database.ts";
import { createVerificationHandler } from "../verify-payment/handler.ts";
import { createWebhookHandler } from "../stripe-webhook/handler.ts";
import { deliverEmails, renderEmail } from "../_shared/email.ts";
import { defaultPresentation } from "../_shared/presentation.ts";
import {
  createEmailHandler,
  handler as emailHandler,
} from "../send-results-email/handler.ts";
import { readBody } from "../_shared/http.ts";

const sessionId = "22222222-2222-4222-8222-222222222222";
const testId = "11111111-1111-4111-8111-111111111111";
const orderId = "33333333-3333-4333-8333-333333333333";
const accessToken = "44444444-4444-4444-8444-444444444444";

Deno.test("private email readiness checks configuration without claiming or sending jobs", async () => {
  const key = "fixture-worker-secret";
  Deno.env.set("RESULT_EMAIL_WORKER_SECRET", key);
  Deno.env.set("RESEND_API_KEY", "fixture-provider-key");
  const reads: string[] = [];
  let invalid = false;
  const handler = createEmailHandler(() => ({
    rpc: () => {
      throw new Error("Readiness must not claim, write or send");
    },
    read: <T>(table: string) => {
      reads.push(table);
      assert.ok(
        ["result_email_outbox", "app_settings", "archetype_results"].includes(
          table,
        ),
      );
      return Promise.resolve(
        table === "result_email_outbox"
          ? [{ id: "private-id" }]
          : table === "app_settings" && invalid
          ? [{ value: "{}" }]
          : [],
      ) as Promise<T>;
    },
  }));
  const request = (authorized = true) =>
    new Request("https://fixture", {
      method: "POST",
      headers: {
        Authorization: authorized ? `Bearer ${key}` : "Bearer public-key",
      },
      body: JSON.stringify({ dryRun: true }),
    });
  try {
    assert.equal((await handler(request(false))).status, 403);
    assert.equal(reads.length, 0);
    const response = await handler(request());
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      protocol: "outbox-v1",
      ready: true,
      hasPendingJobs: true,
    });
    assert.deepEqual(reads.sort(), [
      "app_settings",
      "archetype_results",
      "result_email_outbox",
    ]);
    invalid = true;
    assert.equal((await handler(request())).status, 503);
  } finally {
    Deno.env.delete("RESULT_EMAIL_WORKER_SECRET");
    Deno.env.delete("RESEND_API_KEY");
  }
});
const checkout = () => ({
  id: "cs_test_fixture",
  object: "checkout.session",
  mode: "payment",
  status: "complete",
  currency: "usd",
  amount_subtotal: 200,
  amount_total: 200,
  payment_status: "paid",
  total_details: { amount_discount: 0, amount_tax: 0, amount_shipping: 0 },
  metadata: {
    testSessionId: sessionId,
    testId,
    orderId,
    expectedAmount: "200",
    language: "en",
  },
} as unknown as Stripe.Checkout.Session);
const dbStub = (
  rpc: (name: string, args: Record<string, unknown>) => Promise<unknown>,
): Database => ({
  rpc: async <T>(name: string, args: Record<string, unknown>) =>
    await rpc(name, args) as T,
  read: () => {
    throw new Error("Unexpected table read");
  },
});

Deno.test("canonical Stripe facts accept normal, discounted, free-promo and legacy payments", () => {
  assert.equal(paymentFacts(checkout()).total, 200);
  const discount = checkout();
  discount.amount_total = 100;
  discount.total_details!.amount_discount = 100;
  assert.equal(paymentFacts(discount).total, 100);
  const free = checkout();
  free.amount_total = 0;
  free.total_details!.amount_discount = 200;
  free.payment_status = "no_payment_required";
  assert.equal(paymentFacts(free).total, 0);
  const legacy = checkout();
  delete legacy.metadata!.orderId;
  assert.equal(paymentFacts(legacy).orderId, null);
});
Deno.test("invalid or incomplete payments cannot reach the fulfillment RPC", async () => {
  const changes: Partial<Stripe.Checkout.Session>[] = [
    { status: "open" },
    { mode: "subscription" },
    { payment_status: "unpaid" },
    { currency: "eur" },
    { amount_subtotal: 300 },
    { amount_total: 100 },
    { amount_total: -1 },
    { metadata: {} },
    { amount_total: 0, payment_status: "no_payment_required" },
    { metadata: { ...checkout().metadata, expectedAmount: "0" } },
    { metadata: { ...checkout().metadata, orderId: "invalid" } },
    {
      total_details: { amount_discount: 0, amount_tax: 10, amount_shipping: 0 },
    },
    { amount_total: NaN },
    { amount_subtotal: null },
    { id: "invalid" },
  ];
  for (const change of changes) {
    const db = dbStub(() => {
      throw new Error("Invalid payment reached DB");
    });
    await assert.rejects(
      () => fulfillPayment(db, { ...checkout(), ...change }),
      /Invalid payment facts/,
    );
  }
});
Deno.test("legacy already-paid results do not enqueue historical mail again", async () => {
  const legacy = checkout();
  delete legacy.metadata!.orderId;
  let fulfills = 0;
  let paid = true;
  let wrongCheckout = false;
  const db: Database = {
    rpc: <T>() => {
      fulfills++;
      return Promise.resolve({ success: true }) as Promise<T>;
    },
    read: <T>(table: string, query: string) => {
      assert.equal(table, "test_sessions");
      assert.ok(query.includes(`id=eq.${sessionId}`));
      return Promise.resolve([{
        test_id: testId,
        is_paid: paid,
        stripe_session_id: wrongCheckout ? "cs_test_other" : legacy.id,
        access_token: accessToken,
      }]) as Promise<T>;
    },
  };
  const result = await fulfillPayment(db, legacy);
  assert.equal(result.alreadyProcessed, true);
  assert.equal(result.resultAccessToken, accessToken);
  assert.equal(fulfills, 0);
  wrongCheckout = true;
  await assert.rejects(() => fulfillPayment(db, legacy), /mismatch/);
  assert.equal(fulfills, 0);
  paid = false;
  await fulfillPayment(db, legacy);
  assert.equal(fulfills, 1);
});
Deno.test("fulfillment uses the signed price snapshot without reading current test price", async () => {
  let called = false;
  const db = dbStub((name, args) => {
    called = true;
    assert.equal(name, "fulfill_checkout");
    assert.equal(args.p_expected_amount, 200);
    assert.equal(args.p_order_id, orderId);
    return Promise.resolve({
      success: true,
      resultAccessToken: accessToken,
    }) as ReturnType<Database["rpc"]>;
  });
  assert.equal(
    (await fulfillPayment(db, checkout())).resultAccessToken,
    accessToken,
  );
  assert.ok(called);
});

function stripeMock(responder: (url: string, init: RequestInit) => unknown) {
  return new Stripe("sk_test_fixture", {
    maxNetworkRetries: 0,
    httpClient: Stripe.createFetchHttpClient(async (input, init) => {
      const result = responder(String(input), init || {});
      return new Response(JSON.stringify(result), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  });
}
Deno.test("checkout retries preserve Stripe idempotency key, snapshot, language and return URL", async () => {
  const keys: string[] = [];
  const stripe = stripeMock((url, init) => {
    assert.ok(url.endsWith("/v1/checkout/sessions"));
    const params = new URLSearchParams(String(init.body));
    assert.equal(params.get("line_items[0][price_data][unit_amount]"), "200");
    assert.equal(params.get("metadata[orderId]"), orderId);
    assert.equal(params.get("metadata[language]"), "en");
    assert.equal(params.get("expires_at"), null); // avoid retries changing Stripe's 30-minute minimum
    keys.push(new Headers(init.headers).get("Idempotency-Key")!);
    return {
      ...checkout(),
      status: "open",
      url: "https://checkout.stripe.com/c/pay/fixture",
    };
  });
  const db = dbStub((name, args) => {
    if (name === "prepare_checkout") {
      assert.equal(args.p_access_token, accessToken);
      return Promise.resolve({
        id: orderId,
        session_id: sessionId,
        test_id: testId,
        title: "Fixture",
        expected_amount: 200,
        currency: "usd",
        language: "en",
        return_origin: "https://inner-code.me",
        stripe_checkout_id: null,
        email: null,
      }) as ReturnType<Database["rpc"]>;
    }
    assert.equal(name, "attach_checkout");
    return Promise.resolve(null) as ReturnType<Database["rpc"]>;
  });
  await Promise.all([
    createCheckout(
      db,
      stripe,
      sessionId,
      accessToken,
      "en",
      "https://inner-code.me",
    ),
    createCheckout(
      db,
      stripe,
      sessionId,
      accessToken,
      "en",
      "https://inner-code.me",
    ),
  ]);
  assert.equal(keys.length, 2);
  assert.equal(keys[0], `inner-code-order-${orderId}`);
  assert.equal(keys[0], keys[1]);
});
Deno.test("webhook requires real SDK signature, retrieves canonical checkout, and retries DB failure", async () => {
  let reads = 0, fulfills = 0;
  let fail = false;
  const stripe = stripeMock(() => {
    reads++;
    return checkout();
  });
  const db = dbStub(() => {
    fulfills++;
    if (fail) throw new Error("Database temporarily offline");
    return Promise.resolve({ testSessionId: sessionId }) as ReturnType<
      Database["rpc"]
    >;
  });
  const secret = "whsec_fixture";
  const handler = createWebhookHandler(stripe, db, secret);
  const payload = JSON.stringify({
    id: "evt_fixture",
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: "cs_test_fixture" } },
  });
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  });
  const request = (body = payload, sig = signature) =>
    new Request("https://example.test/webhook", {
      method: "POST",
      body,
      headers: { "stripe-signature": sig },
    });
  assert.equal((await handler(request(payload + " "))).status, 400);
  assert.equal(reads, 0);
  const stale = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    timestamp: 1,
    cryptoProvider: Stripe.createSubtleCryptoProvider(),
  });
  assert.equal((await handler(request(payload, stale))).status, 400);
  assert.equal((await handler(request())).status, 200);
  assert.equal(fulfills, 1);
  assert.equal((await handler(request())).status, 200);
  assert.equal(fulfills, 2);
  fail = true;
  assert.equal((await handler(request())).status, 503);
});
Deno.test("expired Stripe checkout is replaced with a new order instead of replaying a dead URL", async () => {
  let prepared = 0, expired = 0;
  const db = dbStub((name, args) => {
    if (name === "expire_checkout") {
      expired++;
      assert.equal(args.p_checkout_id, "cs_test_expired");
      return Promise.resolve(null);
    }
    if (name === "attach_checkout") return Promise.resolve(null);
    assert.equal(name, "prepare_checkout");
    prepared++;
    return Promise.resolve({
      id: prepared === 1 ? orderId : accessToken,
      session_id: sessionId,
      test_id: testId,
      title: "Fixture",
      expected_amount: 200,
      currency: "usd",
      language: "en",
      return_origin: "https://inner-code.me",
      email: null,
      stripe_checkout_id: prepared === 1 ? "cs_test_expired" : null,
    });
  });
  const stripe = stripeMock((url) =>
    url.endsWith("/cs_test_expired")
      ? { ...checkout(), id: "cs_test_expired", status: "expired", url: null }
      : {
        ...checkout(),
        status: "open",
        url: "https://checkout.stripe.com/c/pay/new",
      }
  );
  assert.equal(
    await createCheckout(
      db,
      stripe,
      sessionId,
      accessToken,
      "en",
      "https://inner-code.me",
    ),
    "https://checkout.stripe.com/c/pay/new",
  );
  assert.equal(prepared, 2);
  assert.equal(expired, 1);
});
Deno.test("email preserves authored interpretations, escapes content and contains a private recovery link", () => {
  const result = {
    id: sessionId,
    email: "fixture@example.test",
    access_token: accessToken,
    is_paid: true,
    overall_score: 0,
    analyst_score: 0,
    strategist_score: 0,
    observer_score: 0,
    intuitive_score: 0,
  };
  const payload = renderEmail(
    { title: "<img src=x onerror=alert(1)>", language: "en" },
    result,
    "support@example.test",
  );
  assert.ok(payload.html.includes("&lt;img"));
  assert.ok(!payload.html.includes("<img"));
  assert.ok(payload.text.includes(`#access_token=${accessToken}`));
  assert.ok(
    payload.text.includes(
      "There are opportunities for improvement in this area.",
    ),
  );
  assert.ok(!payload.text.includes("not an IQ measurement"));
  assert.ok(!payload.text.includes("Analyst."));
  assert.ok(payload.subject.startsWith("Your IQ Test Results"));
  const russian = renderEmail(
    { title: "IQ тест", language: "ru" },
    { ...result, overall_score: 90, analyst_score: 90 },
    "support@example.test",
    {
      title_ru: "Авторский заголовок",
      title_en: "Original heading",
      content_ru: "**Авторский текст** <script>blocked</script>",
      content_en: "Original text",
    },
  );
  assert.ok(
    russian.text.includes(
      "Отлично! Ваши когнитивные способности высокоразвиты.",
    ),
  );
  assert.ok(russian.text.includes("Ваша сильнейшая сторона — Аналитик."));
  assert.ok(russian.html.includes("<strong>Авторский текст</strong>"));
  assert.ok(!russian.html.includes("<script>"));
  assert.equal(russian.subject, "Результаты IQ теста — Балл: 90");
});
Deno.test("email delivery freezes provider body, records failures and reuses the provider idempotency key", async () => {
  Deno.env.set("RESEND_API_KEY", "fixture-only");
  const payload = {
    from: "Fixture <noreply@example.test>",
    to: ["fixture@example.test"],
    subject: "Fixture",
    html: "Fixture",
    text: "Fixture",
  };
  const job = {
    id: orderId,
    session_id: sessionId,
    lease_id: accessToken,
    payload,
  };
  const finishes: Record<string, unknown>[] = [];
  const keys: string[] = [];
  let failure = true;
  const db = dbStub((name, args) => {
    if (name === "claim_result_emails") {
      return Promise.resolve([job]) as ReturnType<Database["rpc"]>;
    }
    assert.equal(name, "finish_result_email");
    finishes.push(args);
    return Promise.resolve(true) as ReturnType<Database["rpc"]>;
  });
  const transport: typeof fetch = (_input, init) => {
    keys.push(new Headers(init?.headers).get("Idempotency-Key")!);
    assert.deepEqual(JSON.parse(String(init?.body)), payload);
    return Promise.resolve(
      new Response(
        JSON.stringify(
          failure ? { error: "not leaked" } : { id: "provider-fixture" },
        ),
        { status: failure ? 503 : 200 },
      ),
    );
  };
  try {
    assert.equal((await deliverEmails(db, sessionId, transport)).sent, 0);
    assert.equal(finishes[0].p_error, "provider_http_503");
    failure = false;
    assert.equal((await deliverEmails(db, sessionId, transport)).sent, 1);
    assert.equal(finishes[1].p_provider_id, "provider-fixture");
    assert.equal(keys[0], keys[1]);
  } finally {
    Deno.env.delete("RESEND_API_KEY");
  }
});
Deno.test("email delivery freezes the stored authored archetype before retrying", async () => {
  Deno.env.set("RESEND_API_KEY", "fixture-only");
  let frozen: ReturnType<typeof renderEmail> | null = null;
  const reads: string[] = [];
  const bodies: string[] = [];
  const db: Database = {
    rpc: async <T>(name: string, args: Record<string, unknown>) => {
      if (name === "claim_result_emails") {
        return [{
          id: orderId,
          session_id: sessionId,
          lease_id: accessToken,
          title: "IQ тест",
          language: "ru",
          payload: frozen,
        }] as T;
      }
      if (name === "set_result_email_payload") {
        frozen = args.p_payload as ReturnType<typeof renderEmail>;
        return frozen as T;
      }
      assert.equal(name, "finish_result_email");
      return true as T;
    },
    read: async <T>(table: string, query: string) => {
      reads.push(table);
      if (table === "test_sessions") {
        return [{
          id: sessionId,
          email: "fixture@example.test",
          access_token: accessToken,
          is_paid: true,
          overall_score: 80,
          analyst_score: 90,
          strategist_score: 90,
          observer_score: 60,
          intuitive_score: 50,
        }] as T;
      }
      if (table === "app_settings") {
        return [{ key: "support_contact", value: "support@example.test" }, {
          key: "result_presentation",
          value: JSON.stringify({
            ...defaultPresentation(),
            ties: "priority",
            priority: ["strategist", "analyst", "observer", "intuitive"],
          }),
        }] as T;
      }
      assert.equal(table, "archetype_results");
      assert.ok(query.startsWith("dimension=eq.strategist&"));
      return [{
        title_ru: "Авторский заголовок",
        title_en: "Original title",
        content_ru: "**Исходный текст** <img src=x>",
        content_en: "Original text",
      }] as T;
    },
  };
  const transport: typeof fetch = (_input, init) => {
    bodies.push(String(init?.body));
    return Promise.resolve(
      new Response(
        JSON.stringify(
          bodies.length === 1
            ? { error: "fixture failure" }
            : { id: "provider-fixture" },
        ),
        { status: bodies.length === 1 ? 503 : 200 },
      ),
    );
  };
  try {
    assert.equal((await deliverEmails(db, sessionId, transport)).sent, 0);
    assert.equal((await deliverEmails(db, sessionId, transport)).sent, 1);
    assert.deepEqual(reads, [
      "test_sessions",
      "app_settings",
      "archetype_results",
    ]);
    assert.equal(bodies[0], bodies[1]);
    const payload = JSON.parse(bodies[0]);
    assert.ok(payload.text.includes("**Исходный текст** <img src=x>"));
    assert.ok(payload.text.includes("Ваша сильнейшая сторона — Стратег."));
    assert.ok(
      payload.html.includes(
        "<strong>Исходный текст</strong> &lt;img src=x&gt;",
      ),
    );
    assert.ok(!payload.html.includes("<img"));
  } finally {
    Deno.env.delete("RESEND_API_KEY");
  }
});
Deno.test("public callers cannot invoke the queue worker; JSON body is bounded", async () => {
  assert.equal(
    (await emailHandler(
      new Request("https://example.test", { method: "POST", body: "{}" }),
    )).status,
    403,
  );
  await assert.rejects(
    () =>
      readBody(
        new Request("https://example.test", {
          method: "POST",
          body: "x".repeat(17000),
        }),
      ),
    /too large/,
  );
});

Deno.test("payment confirmation commits access and outbox without waiting for email delivery", async () => {
  Deno.env.set("RESEND_API_KEY", "fixture-only");
  const calls: string[] = [];
  let stripeReads = 0;
  const stripe = stripeMock(() => {
    stripeReads++;
    return checkout();
  });
  const expected = {
    success: true,
    testSessionId: sessionId,
    testId,
    amountPaid: 200,
    resultAccessToken: accessToken,
    alreadyProcessed: false,
  };
  const db = dbStub((name) => {
    calls.push(name);
    if (name === "fulfill_checkout") return Promise.resolve(expected);
    throw new Error("The private mail worker must own delivery");
  });
  const verify = createVerificationHandler(() => ({ db, stripe }));
  const request = (body: unknown) =>
    new Request("https://example.test/verify", {
      method: "POST",
      headers: { origin: "https://inner-code.me" },
      body: JSON.stringify(body),
    });
  try {
    assert.equal(
      (await verify(request({ stripeSessionId: "invalid" }))).status,
      400,
    );
    assert.equal(stripeReads, 0);
    const response = await verify(
      request({ stripeSessionId: "cs_test_fixture" }),
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), expected);
    assert.deepEqual(calls, ["fulfill_checkout"]);
  } finally {
    Deno.env.delete("RESEND_API_KEY");
  }
});
