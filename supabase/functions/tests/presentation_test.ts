import assert from "node:assert/strict";
import {
  defaultPresentation,
  parsePresentation,
  profileIntro,
  selectProfile,
  validPresentation,
} from "../_shared/presentation.ts";
import { deliverEmails, renderEmail } from "../_shared/email.ts";
import type { Database } from "../_shared/database.ts";
import { getProfileDescription } from "../../../src/lib/resultSummary.ts";
const zeros = {
  analyst_score: 0,
  strategist_score: 0,
  observer_score: 0,
  intuitive_score: 0,
};
Deno.test("presentation defaults, tied priority, zero fallback and missing data agree in UI and mail", () => {
  const defaults = defaultPresentation();
  const policy = {
    ...defaults,
    ties: "priority" as const,
    zero: "observer" as const,
    priority: [
      "strategist",
      "observer",
      "analyst",
      "intuitive",
    ] as typeof defaults.priority,
  };
  for (
    const scores of [zeros, {
      ...zeros,
      analyst_score: 80,
      strategist_score: 80,
    }]
  ) {
    const intro = profileIntro(scores, "ru", policy);
    assert.ok(getProfileDescription(scores, "ru", policy).startsWith(intro));
    const email = renderEmail(
      { title: "IQ тест", language: "ru" },
      {
        id: "fixture",
        email: "fixture@example.test",
        access_token: "fixture",
        is_paid: true,
        overall_score: 40,
        ...scores,
      },
      "support@example.test",
      null,
      policy,
    );
    assert.ok(email.text.includes(intro));
  }
  assert.deepEqual(
    selectProfile(
      { ...zeros, analyst_score: 80, strategist_score: 80 },
      defaults,
    ),
    { kind: "mixed", leaders: ["analyst", "strategist"] },
  );
  assert.deepEqual(
    selectProfile({ ...zeros, analyst_score: 80, intuitive_score: 80 }, policy),
    { kind: "single", leaders: ["analyst"] },
  );
  assert.deepEqual(
    selectProfile({
      analyst_score: null,
      strategist_score: null,
      observer_score: null,
      intuitive_score: null,
    }, policy),
    { kind: "none", leaders: [] },
  );
  assert.deepEqual(selectProfile({ ...zeros, observer_score: null }, policy), {
    kind: "none",
    leaders: [],
  });
  assert.deepEqual(
    selectProfile({
      ...zeros,
      analyst_score: NaN,
      strategist_score: Infinity,
      observer_score: -1,
      intuitive_score: 101,
    }, policy),
    { kind: "none", leaders: [] },
  );
});
Deno.test("invalid settings fall back safely and message templates remain escaped in mail", () => {
  const defaults = defaultPresentation();
  for (
    const raw of [
      "bad",
      {},
      { ...defaults, ties: ["mixed"] },
      { ...defaults, zero: ["observer"] },
      {
        ...defaults,
        priority: ["analyst", "analyst", "observer", "intuitive"],
      },
      {
        ...defaults,
        messages: { profileMixed: { ru: "missing placeholder" } },
      },
      { ...defaults, messages: { emailSent: { ru: "x".repeat(1001) } } },
      { ...defaults, messages: { emailSent: { de: "unsupported" } } },
    ]
  ) {
    assert.equal(validPresentation(raw), false);
    assert.deepEqual(parsePresentation(raw), defaults);
  }
  const custom = defaultPresentation();
  custom.messages.profileMixed.ru =
    "Авторский <script>текст</script>: {dimensions}";
  const scores = { ...zeros, analyst_score: 80, strategist_score: 80 };
  const email = renderEmail(
    { title: "IQ тест", language: "ru" },
    {
      id: "fixture",
      email: "fixture@example.test",
      access_token: "fixture",
      is_paid: true,
      overall_score: 40,
      ...scores,
    },
    "support@example.test",
    null,
    custom,
  );
  assert.ok(
    email.text.includes("Авторский <script>текст</script>: Аналитик, Стратег"),
  );
  assert.ok(
    email.html.includes(
      "Авторский &lt;script&gt;текст&lt;/script&gt;: Аналитик, Стратег",
    ),
  );
  assert.ok(!email.html.includes("<script>"));
  assert.deepEqual(
    parsePresentation(
      JSON.stringify({
        version: 1,
        ties: "mixed",
        zero: "none",
        priority: defaults.priority,
        messages: {},
      }),
    ),
    defaults,
  );
});

Deno.test("invalid configured rules never send an email with a guessed direction", async () => {
  Deno.env.set("RESEND_API_KEY", "fixture-only");
  let calls = 0;
  let deliveryError: unknown;
  const db: Database = {
    rpc: async <T>(name: string, args: Record<string, unknown>) => {
      if (name === "claim_result_emails") {
        return [{
          id: "fixture",
          session_id: "fixture",
          lease_id: "fixture",
          payload: null,
          title: "Fixture",
          language: "ru",
        }] as T;
      }
      assert.equal(name, "finish_result_email");
      deliveryError = args.p_error;
      return true as T;
    },
    read: async <T>(table: string) =>
      table === "test_sessions"
        ? [{
          id: "fixture",
          email: "fixture@example.test",
          access_token: "fixture",
          is_paid: true,
          overall_score: 40,
          ...zeros,
        }] as T
        : [{ key: "result_presentation", value: '{"version":99}' }] as T,
  };
  const transport: typeof fetch = () => {
    calls++;
    throw new Error("Unexpected provider request");
  };
  try {
    assert.equal((await deliverEmails(db, "fixture", transport)).sent, 0);
    assert.equal(calls, 0);
    assert.equal(deliveryError, "delivery_unconfirmed");
  } finally {
    Deno.env.delete("RESEND_API_KEY");
  }
});
