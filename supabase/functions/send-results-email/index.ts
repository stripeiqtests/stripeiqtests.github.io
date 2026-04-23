import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple markdown to HTML converter for archetype content  
function markdownToHtml(text: string): string {
  if (!text) return '';

  return text
    .split('\n')
    .map(line => {
      // Bold text with **
      let processed = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

      // Bullet points
      if (line.trim().startsWith('•')) {
        return `<li style="margin-left: 16px; color: #374151;">${processed.replace('•', '').trim()}</li>`;
      }

      // Empty lines
      if (line.trim() === '') {
        return '<br/>';
      }

      // Regular paragraph
      return `<p style="margin: 4px 0; color: #374151;">${processed}</p>`;
    })
    .join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    console.log('Processing email for session:', sessionId);

    // Get secrets
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://afsoyuczexiztsjntkvi.supabase.co';
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

    // Determine strongest dimension
    const scores = [
      { dimension: 'analyst', score: session.analyst_score || 0, labelRu: 'Аналитик', labelEn: 'Analyst' },
      { dimension: 'strategist', score: session.strategist_score || 0, labelRu: 'Стратег', labelEn: 'Strategist' },
      { dimension: 'observer', score: session.observer_score || 0, labelRu: 'Наблюдатель', labelEn: 'Observer' },
      { dimension: 'intuitive', score: session.intuitive_score || 0, labelRu: 'Интуит', labelEn: 'Intuitive' },
    ];
    const strongest = scores.reduce((max, s) => s.score > max.score ? s : max);

    // Fetch archetype result for strongest dimension
    let archetypeHtml = '';
    try {
      const archetypeResponse = await fetch(
        `${supabaseUrl}/rest/v1/archetype_results?dimension=eq.${strongest.dimension}&select=*`,
        {
          headers: {
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`,
          },
        }
      );

      if (archetypeResponse.ok) {
        const archetypes = await archetypeResponse.json();
        const archetype = archetypes[0];

        if (archetype) {
          // Choose language based on email domain or default to Russian
          const isRussian = true; // Default to Russian for now
          const title = isRussian ? archetype.title_ru : archetype.title_en;
          const content = isRussian ? archetype.content_ru : archetype.content_en;

          const dimensionColors: Record<string, { bg: string; border: string; text: string }> = {
            analyst: { bg: '#EFF6FF', border: '#3B82F6', text: '#1D4ED8' },
            strategist: { bg: '#F5F3FF', border: '#8B5CF6', text: '#6D28D9' },
            observer: { bg: '#ECFDF5', border: '#10B981', text: '#047857' },
            intuitive: { bg: '#FFFBEB', border: '#F59E0B', text: '#B45309' },
          };
          const colors = dimensionColors[archetype.dimension] || dimensionColors.analyst;

          archetypeHtml = `
            <div style="background: ${colors.bg}; border: 2px solid ${colors.border}; border-radius: 12px; margin: 20px 30px; overflow: hidden;">
              <div style="padding: 16px 20px; border-bottom: 1px solid ${colors.border};">
                <h3 style="margin: 0; color: ${colors.text}; font-size: 18px;">${title}</h3>
              </div>
              <div style="padding: 20px; font-size: 14px; line-height: 1.6;">
                ${markdownToHtml(content)}
              </div>
            </div>
          `;
        }
      }
    } catch (err) {
      console.log('Could not fetch archetype result:', err);
    }

    // Build profile description
    const profileText = `Ваша сильнейшая сторона — ${strongest.labelRu}.`;

    // Build email HTML - matching the results page design
    const emailBody = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #EEF2FF 0%, #FFFFFF 50%, #F5F3FF 100%); margin: 0; padding: 40px 20px;">
          <div style="max-width: 600px; margin: 0 auto;">
            
            <!-- Header with Logo -->
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-block; background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%); padding: 16px; border-radius: 16px;">
                <span style="font-size: 40px;">🧠</span>
              </div>
              <h1 style="color: #1F2937; margin: 20px 0 10px; font-size: 28px;">Результаты IQ теста</h1>
              <p style="color: #6B7280; margin: 0;">Полный IQ тест</p>
            </div>
            
            <!-- Overall Score Card -->
            <div style="background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #E5E7EB; padding: 40px; margin-bottom: 20px; text-align: center;">
              <p style="color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px;">ОБЩИЙ БАЛЛ</p>
              <div style="font-size: 72px; font-weight: bold; color: #4F46E5; line-height: 1;">${Math.round(session.overall_score || 0)}</div>
              <p style="color: #6B7280; margin: 10px 0 0; font-size: 14px;">
                ${session.overall_score >= 80 ? 'Отлично! Ваши когнитивные способности высокоразвиты.' :
        session.overall_score >= 60 ? 'Хороший результат! Ваши способности выше среднего.' :
          session.overall_score >= 40 ? 'Средний результат. Есть потенциал для развития.' :
            'Есть возможности для улучшения в этой области.'}
              </p>
            </div>
            
            <!-- Dimension Scores Grid -->
            <div style="margin-bottom: 20px;">
              <!-- Row 1 -->
              <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
                <tr>
                  <td width="49%" style="background: #EFF6FF; border: 2px solid #BFDBFE; border-radius: 12px; padding: 20px; vertical-align: top;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <strong style="color: #1F2937;">Аналитик</strong>
                      <span style="font-size: 24px; font-weight: bold; color: #3B82F6;">${Math.round(session.analyst_score || 0)}%</span>
                    </div>
                    <p style="color: #6B7280; font-size: 12px; margin: 8px 0 0;">Логическое мышление, анализ данных</p>
                    <div style="background: white; border-radius: 4px; height: 8px; margin-top: 12px; overflow: hidden;">
                      <div style="background: #3B82F6; height: 100%; width: ${session.analyst_score || 0}%; border-radius: 4px;"></div>
                    </div>
                  </td>
                  <td width="2%"></td>
                  <td width="49%" style="background: #F5F3FF; border: 2px solid #DDD6FE; border-radius: 12px; padding: 20px; vertical-align: top;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <strong style="color: #1F2937;">Стратег</strong>
                      <span style="font-size: 24px; font-weight: bold; color: #8B5CF6;">${Math.round(session.strategist_score || 0)}%</span>
                    </div>
                    <p style="color: #6B7280; font-size: 12px; margin: 8px 0 0;">Планирование, оптимизация</p>
                    <div style="background: white; border-radius: 4px; height: 8px; margin-top: 12px; overflow: hidden;">
                      <div style="background: #8B5CF6; height: 100%; width: ${session.strategist_score || 0}%; border-radius: 4px;"></div>
                    </div>
                  </td>
                </tr>
              </table>
              
              <!-- Row 2 -->
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="49%" style="background: #ECFDF5; border: 2px solid #A7F3D0; border-radius: 12px; padding: 20px; vertical-align: top;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <strong style="color: #1F2937;">Наблюдатель</strong>
                      <span style="font-size: 24px; font-weight: bold; color: #10B981;">${Math.round(session.observer_score || 0)}%</span>
                    </div>
                    <p style="color: #6B7280; font-size: 12px; margin: 8px 0 0;">Визуальное восприятие, пространственное мышление</p>
                    <div style="background: white; border-radius: 4px; height: 8px; margin-top: 12px; overflow: hidden;">
                      <div style="background: #10B981; height: 100%; width: ${session.observer_score || 0}%; border-radius: 4px;"></div>
                    </div>
                  </td>
                  <td width="2%"></td>
                  <td width="49%" style="background: #FFFBEB; border: 2px solid #FDE68A; border-radius: 12px; padding: 20px; vertical-align: top;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                      <strong style="color: #1F2937;">Интуит</strong>
                      <span style="font-size: 24px; font-weight: bold; color: #F59E0B;">${Math.round(session.intuitive_score || 0)}%</span>
                    </div>
                    <p style="color: #6B7280; font-size: 12px; margin: 8px 0 0;">Креативность, ассоциативное мышление</p>
                    <div style="background: white; border-radius: 4px; height: 8px; margin-top: 12px; overflow: hidden;">
                      <div style="background: #F59E0B; height: 100%; width: ${session.intuitive_score || 0}%; border-radius: 4px;"></div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>
            
            <!-- Profile Description -->
            <div style="background: white; border-radius: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #E5E7EB; padding: 24px; margin-bottom: 20px;">
              <h3 style="color: #1F2937; margin: 0 0 16px; font-size: 18px;">Ваш когнитивный профиль</h3>
              <p style="color: #4B5563; margin: 0; line-height: 1.7;">
                ${profileText}
              </p>
            </div>
            
            <!-- Archetype Result Block -->
            ${archetypeHtml}
            
            <!-- Footer -->
            <div style="text-align: center; padding: 30px 0; color: #9CA3AF; font-size: 12px;">
              <p style="margin: 0;">Спасибо за прохождение нашего когнитивного теста!</p>
              <p style="margin: 10px 0 0;">
                <a href="https://inner-code.me" style="color: #4F46E5; text-decoration: none;">inner-code.me</a>
              </p>
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
        from: 'IQ Test <noreply@inner-code.me>',
        to: [session.email],
        subject: `Результаты IQ теста — Балл: ${Math.round(session.overall_score || 0)}`,
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
