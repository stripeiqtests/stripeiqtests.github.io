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

    const { stripeSessionId } = await req.json();
    if (typeof stripeSessionId !== 'string' || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(stripeSessionId)) {
      return json({ error: 'Invalid Stripe session ID' }, 400, origin);
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2023-10-16' });
    const checkoutSession = await stripe.checkout.sessions.retrieve(stripeSessionId);
    if (checkoutSession.payment_status !== 'paid') {
      return json({ error: 'Payment not completed' }, 402, origin);
    }

    const testSessionId = checkoutSession.metadata?.testSessionId;
    const testId = checkoutSession.metadata?.testId;
    if (!testSessionId || !testId) throw new Error('Stripe metadata is incomplete');

    const apiHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    };

    const [sessionResponse, testResponse] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/test_sessions?id=eq.${encodeURIComponent(testSessionId)}&select=id,test_id,email,is_paid,stripe_session_id`,
        { headers: apiHeaders },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/tests?id=eq.${encodeURIComponent(testId)}&select=id,price_cents`,
        { headers: apiHeaders },
      ),
    ]);
    if (!sessionResponse.ok || !testResponse.ok) throw new Error('Unable to validate payment data');

    const session = (await sessionResponse.json())[0];
    const test = (await testResponse.json())[0];
    if (!session || !test || session.test_id !== test.id) throw new Error('Payment data mismatch');
    if (checkoutSession.currency !== 'usd' || checkoutSession.amount_total !== test.price_cents) {
      throw new Error('Paid amount does not match the test price');
    }

    if (session.is_paid) {
      if (session.stripe_session_id !== stripeSessionId) throw new Error('Session was paid by another checkout');
      return json({
        success: true,
        testSessionId,
        testId,
        amountPaid: checkoutSession.amount_total,
        alreadyProcessed: true,
      }, 200, origin);
    }

    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/test_sessions?id=eq.${encodeURIComponent(testSessionId)}&is_paid=eq.false`,
      {
        method: 'PATCH',
        headers: {
          ...apiHeaders,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ is_paid: true, stripe_session_id: stripeSessionId }),
      },
    );
    if (!updateResponse.ok) throw new Error('Unable to unlock results');
    const updatedSession = (await updateResponse.json())[0];
    if (!updatedSession) throw new Error('Payment was already being processed');

    if (updatedSession.email) {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-results-email`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: testSessionId }),
      });
      if (!emailResponse.ok) {
        console.error('Email request failed:', emailResponse.status, await emailResponse.text());
      }
    }

    return json({
      success: true,
      testSessionId,
      testId,
      amountPaid: checkoutSession.amount_total,
    }, 200, origin);
  } catch (error) {
    console.error('Payment verification error:', error);
    return json({ error: 'Unable to verify payment' }, 400, origin);
  }
});
