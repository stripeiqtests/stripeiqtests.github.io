import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
const serviceKey =
  Deno.env.get('SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const configuredAppDomain = Deno.env.get('APP_DOMAIN');

function normalizeOrigin(value: string | undefined) {
  if (!value) return undefined;
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return undefined;
  }
}

const appOrigin = normalizeOrigin(configuredAppDomain);

const allowedOrigins = new Set([
  'https://inner-code.me',
  'https://www.inner-code.me',
  'https://stripeiqtests.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...(appOrigin ? [appOrigin] : []),
]);

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'https://inner-code.me',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return allowedOrigins.has(origin || '')
      ? new Response(null, { headers: corsHeaders(origin) })
      : json({ error: 'Origin is not allowed' }, 403, origin);
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (origin && !allowedOrigins.has(origin)) return json({ error: 'Origin is not allowed' }, 403, origin);

  try {
    if (!stripeSecretKey || !serviceKey || !supabaseUrl) {
      throw new Error('Required server configuration is missing');
    }

    const { sessionId, accessToken } = await req.json();
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (typeof sessionId !== 'string' || typeof accessToken !== 'string' ||
        !uuidPattern.test(sessionId) || !uuidPattern.test(accessToken)) {
      return json({ error: 'Invalid session capability' }, 400, origin);
    }

    const apiHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    const sessionResponse = await fetch(
      `${supabaseUrl}/rest/v1/test_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,test_id,email,is_paid,access_token`,
      { headers: apiHeaders },
    );
    if (!sessionResponse.ok) throw new Error('Unable to load test session');
    const session = (await sessionResponse.json())[0];
    if (!session) return json({ error: 'Test session not found' }, 404, origin);
    if (session.access_token !== accessToken) return json({ error: 'Test session not found' }, 404, origin);
    if (session.is_paid) return json({ error: 'Test session is already paid' }, 409, origin);

    const testResponse = await fetch(
      `${supabaseUrl}/rest/v1/tests?id=eq.${encodeURIComponent(session.test_id)}&select=id,title,price_cents,is_active`,
      { headers: apiHeaders },
    );
    if (!testResponse.ok) throw new Error('Unable to load test');
    const test = (await testResponse.json())[0];
    if (!test || !test.is_active) return json({ error: 'Test is not available' }, 404, origin);
    if (!Number.isInteger(test.price_cents) || test.price_cents < 50 || test.price_cents > 100000) {
      throw new Error('Invalid test price');
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const redirectOrigin = origin && allowedOrigins.has(origin)
      ? origin
      : appOrigin || 'https://inner-code.me';

    const checkoutSession = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: test.title || 'IQ Test Results',
              description: 'Unlock your detailed cognitive profile and analysis',
            },
            unit_amount: test.price_cents,
          },
          quantity: 1,
        }],
        success_url: `${redirectOrigin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${redirectOrigin}/payment/cancel?session_id=${session.id}`,
        customer_email: session.email || undefined,
        metadata: {
          testSessionId: session.id,
          testId: test.id,
          expectedAmount: String(test.price_cents),
        },
        allow_promotion_codes: true,
      },
      { idempotencyKey: `iq-test-checkout-${session.id}` },
    );

    return json({ url: checkoutSession.url }, 200, origin);
  } catch (error) {
    console.error('Checkout error:', error);
    return json({ error: 'Unable to create checkout session' }, 500, origin);
  }
});
