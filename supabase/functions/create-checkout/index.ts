import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, testId, priceInCents, email } = await req.json();

    // Input validation
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid or missing sessionId');
    }
    if (!testId || typeof testId !== 'string') {
      throw new Error('Invalid or missing testId');
    }

    // Get the origin for redirect URLs
    const origin = req.headers.get('origin') || 'https://stripeiqtests.github.io';

    // Create Stripe checkout session
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'IQ Test Results',
              description: 'Unlock your detailed cognitive profile and analysis',
            },
            unit_amount: priceInCents || 500, // Default $5.00
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment/cancel?session_id=${sessionId}`,
      customer_email: email || undefined,
      metadata: {
        testSessionId: sessionId,
        testId: testId,
      },
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: checkoutSession.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
