import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    console.log('Processing email for session:', sessionId);

    // Get secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://movuagoqspojzshirvuz.supabase.co';
    const serviceKey = Deno.env.get('SERVICE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    console.log('SUPABASE_URL:', supabaseUrl);
    console.log('SERVICE_KEY available:', !!serviceKey);
    console.log('RESEND_API_KEY available:', !!resendApiKey);

    if (!serviceKey) {
      return new Response(
        JSON.stringify({ error: 'SERVICE_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch session data using direct API
    const sessionResponse = await fetch(
      `${supabaseUrl}/rest/v1/test_sessions?id=eq.${sessionId}&select=*`,
      {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      }
    );

    console.log('Session fetch status:', sessionResponse.status);

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      return new Response(
        JSON.stringify({ error: `Failed to fetch session: ${errorText}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessions = await sessionResponse.json();
    const session = sessions[0];

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Session found, email:', session.email);

    if (!session.email) {
      return new Response(
        JSON.stringify({ success: false, reason: 'No email provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build email HTML
    const emailBody = `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            
            <div style="background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">🧠 Your IQ Test Results</h1>
            </div>
            
            <div style="text-align: center; padding: 30px;">
              <div style="font-size: 64px; font-weight: bold; color: #4F46E5;">${Math.round(session.overall_score || 0)}</div>
              <div style="font-size: 18px; color: #666;">Overall Score</div>
            </div>
            
            <div style="padding: 0 30px 30px;">
              <h2 style="color: #1a1a1a; border-bottom: 2px solid #eee; padding-bottom: 10px;">Dimension Scores</h2>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #3B82F6;">
                <div style="font-size: 16px;"><strong>🔍 Analyst:</strong> <span style="font-size: 24px; font-weight: bold; color: #3B82F6;">${Math.round(session.analyst_score || 0)}%</span></div>
              </div>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #8B5CF6;">
                <div style="font-size: 16px;"><strong>♟️ Strategist:</strong> <span style="font-size: 24px; font-weight: bold; color: #8B5CF6;">${Math.round(session.strategist_score || 0)}%</span></div>
              </div>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #10B981;">
                <div style="font-size: 16px;"><strong>👁️ Observer:</strong> <span style="font-size: 24px; font-weight: bold; color: #10B981;">${Math.round(session.observer_score || 0)}%</span></div>
              </div>
              
              <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #F59E0B;">
                <div style="font-size: 16px;"><strong>💡 Intuitive:</strong> <span style="font-size: 24px; font-weight: bold; color: #F59E0B;">${Math.round(session.intuitive_score || 0)}%</span></div>
              </div>
            </div>
            
            <div style="background: #f8f9fa; padding: 20px 30px; text-align: center;">
              <p style="margin: 0; font-size: 14px; color: #666;">Thank you for taking our cognitive assessment!</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend
    console.log('Sending email to:', session.email);
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'IQ Test <onboarding@resend.dev>',
        to: [session.email],
        subject: `Your IQ Test Results - Score: ${Math.round(session.overall_score || 0)}`,
        html: emailBody,
      }),
    });

    const emailResult = await emailResponse.json();
    console.log('Resend response:', emailResponse.status, emailResult);

    if (!emailResponse.ok) {
      return new Response(
        JSON.stringify({ error: `Email send failed: ${JSON.stringify(emailResult)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Email error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
