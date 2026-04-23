import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';

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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    const { stripeSessionId } = await req.json();
    console.log('Verifying payment for session:', stripeSessionId);

    if (!stripeSessionId) {
      throw new Error('No stripe session ID provided');
    }

    // Retrieve the checkout session from Stripe
    const checkoutSession = await stripe.checkout.sessions.retrieve(stripeSessionId);
    console.log('Checkout session status:', checkoutSession.payment_status);

    if (checkoutSession.payment_status !== 'paid') {
      throw new Error('Payment not completed');
    }

    const testSessionId = checkoutSession.metadata?.testSessionId;
    console.log('Test session ID from metadata:', testSessionId);

    if (!testSessionId) {
      throw new Error('Test session ID not found in Stripe metadata');
    }

    // Get the service key
    const serviceKey = Deno.env.get('SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://afsoyuczexiztsjntkvi.supabase.co';

    if (!serviceKey) {
      throw new Error('No service key available');
    }

    // FIRST: Check if this session was already processed (to prevent double emails)
    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/test_sessions?id=eq.${testSessionId}&select=id,email,is_paid,stripe_session_id`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      }
    );

    const existingSessions = await checkResponse.json();
    const existingSession = existingSessions[0];

    if (!existingSession) {
      throw new Error('Test session not found');
    }

    // If already paid with same stripe session, skip everything
    if (existingSession.is_paid && existingSession.stripe_session_id === stripeSessionId) {
      console.log('Session already processed, skipping');
      return new Response(
        JSON.stringify({ success: true, testSessionId, alreadyProcessed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the session
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/test_sessions?id=eq.${testSessionId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({
          is_paid: true,
          stripe_session_id: stripeSessionId,
        }),
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Database update failed: ${updateResponse.status} - ${errorText}`);
    }

    const sessions = await updateResponse.json();
    const session = sessions[0];

    console.log('Session updated successfully:', session.id);

    // Send results email if email exists (only happens on first call)
    if (session.email) {
      console.log('Sending results email to:', session.email);
      try {
        await fetch(`${supabaseUrl}/functions/v1/send-results-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ sessionId: testSessionId }),
        });
        console.log('Email request sent');
      } catch (emailError) {
        console.error('Email sending failed (non-critical):', emailError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, testSessionId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Verification error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
