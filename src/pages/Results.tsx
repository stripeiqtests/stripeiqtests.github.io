import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { TestSession, Test, HomeContent } from '../lib/supabase';
import { Brain, Lock, CreditCard, Mail, CheckCircle } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../lib/i18n';
import { useAdmin } from '../lib/AdminContext';
import { EditableField } from '../components/EditableField';

export function Results() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const { t, lang } = useLanguage();
  const { isAdmin } = useAdmin();

  // Preview mode check
  const isPreview = searchParams.get('preview') === 'admin';

  // Mock data for preview mode
  const mockSession: TestSession = {
    id: 'preview-session',
    test_id: 'preview-test',
    email: 'demo@example.com',
    answers: '{}',
    is_paid: true,
    overall_score: 78,
    analyst_score: 85,
    strategist_score: 72,
    observer_score: 65,
    intuitive_score: 88,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    stripe_session_id: null,
  };

  const mockTest: Test = {
    id: 'preview-test',
    title: lang === 'ru' ? 'IQ Тест (Превью)' : 'IQ Test (Preview)',
    slug: 'preview',
    description: 'Preview mode',
    price_cents: 500,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const [session, setSession] = useState<TestSession | null>(isPreview ? mockSession : null);
  const [test, setTest] = useState<Test | null>(isPreview ? mockTest : null);
  const [loading, setLoading] = useState(!isPreview);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [content, setContent] = useState<Record<string, string>>({});

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    if (sessionId && !isPreview) {
      loadSession();
    }
  }, [sessionId, isPreview]);

  async function loadContent() {
    const { data } = await supabase
      .from('home_content')
      .select('*');

    if (data) {
      const contentMap: Record<string, string> = {};
      data.forEach((item: HomeContent) => {
        contentMap[item.key] = item.value;
      });
      setContent(contentMap);
    }
  }

  async function saveContent(key: string, value: string) {
    const { error } = await supabase
      .from('home_content')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('key', key);

    if (error) {
      console.error('Error saving content:', error);
      throw error;
    }

    setContent(prev => ({ ...prev, [key]: value }));
  }

  const getContent = (key: string, fallback: string) => content[key] || fallback;


  async function loadSession() {
    const { data: sessionData, error: sessionError } = await supabase
      .from('test_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !sessionData) {
      setLoading(false);
      return;
    }

    setSession(sessionData);

    // Load test info
    const { data: testData } = await supabase
      .from('tests')
      .select('*')
      .eq('id', sessionData.test_id)
      .single();

    if (testData) {
      setTest(testData);
    }

    setLoading(false);
  }

  async function handlePayment() {
    if (!session || !test) return;

    setProcessingPayment(true);

    try {
      // Call Supabase Edge Function to create Stripe checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          sessionId: session.id,
          testId: test.id,
          priceInCents: test.price_cents,
          email: session.email,
        },
      });

      if (error) throw error;

      // Redirect to Stripe checkout
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Payment error:', err);
      alert(lang === 'ru' ? 'Ошибка оплаты. Попробуйте еще раз.' : 'Failed to initiate payment. Please try again.');
      setProcessingPayment(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {lang === 'ru' ? 'Сессия не найдена' : 'Session Not Found'}
          </h1>
          <p className="text-gray-500 mb-6">
            {lang === 'ru' ? 'Эта тестовая сессия не существует или истекла.' : "This test session doesn't exist or has expired."}
          </p>
          <Link
            to="/"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700"
          >
            {lang === 'ru' ? 'Пройти новый тест' : 'Take a New Test'}
          </Link>
        </div>
      </div>
    );
  }

  // Payment required
  if (!session.is_paid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          {/* Language Switcher */}
          <div className="flex justify-end mb-4">
            <LanguageSwitcher />
          </div>

          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-10 h-10 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {lang === 'ru' ? 'Тест завершён!' : 'Test Completed!'}
            </h1>
            <p className="text-gray-500 mt-2">
              {lang === 'ru' ? 'Разблокируйте ваши подробные результаты' : 'Unlock your detailed results'}
            </p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="font-medium text-gray-900 mb-4">{t('results.includes')}</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {t('results.includes_score')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {t('results.includes_dimensions')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {t('results.includes_analysis')}
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {t('results.includes_career')}
              </li>
              {session.email && (
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-green-500" />
                  {t('results.includes_email')}
                </li>
              )}
            </ul>
          </div>

          {/* Price */}
          <div className="text-center mb-6">
            <span className="text-4xl font-bold text-gray-900">
              ${test ? (test.price_cents / 100).toFixed(2) : '5.00'}
            </span>
            <p className="text-sm text-gray-500 mt-1">
              {lang === 'ru' ? 'Единовременный платёж' : 'One-time payment'}
            </p>
          </div>

          {/* Payment Button */}
          <button
            onClick={handlePayment}
            disabled={processingPayment}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-4 rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {processingPayment ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                {t('payment.processing')}
              </>
            ) : (
              <>
                <CreditCard className="w-5 h-5" />
                {t('results.unlock')}
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center mt-4">
            {lang === 'ru' ? 'Безопасная оплата через Stripe' : 'Secure payment powered by Stripe'}
          </p>

          <Link
            to="/"
            className="block text-center mt-6 text-sm text-gray-500 hover:text-gray-700"
          >
            ← {lang === 'ru' ? 'На главную' : 'Back to Home'}
          </Link>
        </div>
      </div>
    );
  }

  // Show results (paid)
  // Helper for editable text with language suffix
  const langKey = lang === 'ru' ? '_ru' : '_en';
  const resultsTitle = lang === 'ru' ? 'Результаты IQ теста' : 'Your IQ Test Results';
  const overallScoreLabel = lang === 'ru' ? 'ОБЩИЙ БАЛЛ' : 'OVERALL SCORE';
  const profileHeading = lang === 'ru' ? 'Ваш когнитивный профиль' : 'Your Cognitive Profile';
  const emailSentText = lang === 'ru' ? 'Копия результатов отправлена на' : 'A copy of these results has been sent to';
  const takeAnotherText = lang === 'ru' ? 'Пройти другой тест' : 'Take Another Test';

  // Dimension labels
  const analystTitle = lang === 'ru' ? 'Аналитик' : 'Analyst';
  const analystDesc = lang === 'ru' ? 'Логическое мышление, анализ данных' : 'Logical thinking, data analysis';
  const strategistTitle = lang === 'ru' ? 'Стратег' : 'Strategist';
  const strategistDesc = lang === 'ru' ? 'Планирование, оптимизация' : 'Planning, optimization';
  const observerTitle = lang === 'ru' ? 'Наблюдатель' : 'Observer';
  const observerDesc = lang === 'ru' ? 'Визуальное восприятие, пространственное мышление' : 'Visual perception, spatial thinking';
  const intuitiveTitle = lang === 'ru' ? 'Интуит' : 'Intuitive';
  const intuitiveDesc = lang === 'ru' ? 'Креативность, ассоциативное мышление' : 'Creativity, associative thinking';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Language Switcher */}
        <div className="flex justify-end mb-4">
          <LanguageSwitcher />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <Brain className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
          {isAdmin && isPreview ? (
            <EditableField
              value={getContent(`results_title${langKey}`, resultsTitle)}
              onSave={(value) => saveContent(`results_title${langKey}`, value)}
              as="h1"
              className="text-3xl font-bold text-gray-900"
            />
          ) : (
            <h1 className="text-3xl font-bold text-gray-900">{getContent(`results_title${langKey}`, resultsTitle)}</h1>
          )}
          <p className="text-gray-500 mt-2">{test?.title}</p>
        </div>

        {/* Overall Score */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6 text-center">
          {isAdmin && isPreview ? (
            <EditableField
              value={getContent(`results_overall_score${langKey}`, overallScoreLabel)}
              onSave={(value) => saveContent(`results_overall_score${langKey}`, value)}
              as="p"
              className="text-sm text-gray-500 uppercase tracking-wide mb-2"
            />
          ) : (
            <p className="text-sm text-gray-500 uppercase tracking-wide mb-2">{getContent(`results_overall_score${langKey}`, overallScoreLabel)}</p>
          )}
          <div className="text-6xl font-bold text-indigo-600 mb-2">
            {Math.round(session.overall_score || 0)}
          </div>
          <p className="text-gray-600">
            {getScoreInterpretation(session.overall_score || 0, lang)}
          </p>
        </div>

        {/* Dimension Scores */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <DimensionCard
            title={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_analyst_title${langKey}`, analystTitle)}
                onSave={(value) => saveContent(`results_analyst_title${langKey}`, value)}
                as="span"
                className="font-semibold text-gray-900"
              />
            ) : getContent(`results_analyst_title${langKey}`, analystTitle)}
            score={session.analyst_score || 0}
            color="blue"
            description={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_analyst_desc${langKey}`, analystDesc)}
                onSave={(value) => saveContent(`results_analyst_desc${langKey}`, value)}
                as="span"
                className="text-sm text-gray-600"
              />
            ) : getContent(`results_analyst_desc${langKey}`, analystDesc)}
          />
          <DimensionCard
            title={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_strategist_title${langKey}`, strategistTitle)}
                onSave={(value) => saveContent(`results_strategist_title${langKey}`, value)}
                as="span"
                className="font-semibold text-gray-900"
              />
            ) : getContent(`results_strategist_title${langKey}`, strategistTitle)}
            score={session.strategist_score || 0}
            color="purple"
            description={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_strategist_desc${langKey}`, strategistDesc)}
                onSave={(value) => saveContent(`results_strategist_desc${langKey}`, value)}
                as="span"
                className="text-sm text-gray-600"
              />
            ) : getContent(`results_strategist_desc${langKey}`, strategistDesc)}
          />
          <DimensionCard
            title={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_observer_title${langKey}`, observerTitle)}
                onSave={(value) => saveContent(`results_observer_title${langKey}`, value)}
                as="span"
                className="font-semibold text-gray-900"
              />
            ) : getContent(`results_observer_title${langKey}`, observerTitle)}
            score={session.observer_score || 0}
            color="green"
            description={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_observer_desc${langKey}`, observerDesc)}
                onSave={(value) => saveContent(`results_observer_desc${langKey}`, value)}
                as="span"
                className="text-sm text-gray-600"
              />
            ) : getContent(`results_observer_desc${langKey}`, observerDesc)}
          />
          <DimensionCard
            title={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_intuitive_title${langKey}`, intuitiveTitle)}
                onSave={(value) => saveContent(`results_intuitive_title${langKey}`, value)}
                as="span"
                className="font-semibold text-gray-900"
              />
            ) : getContent(`results_intuitive_title${langKey}`, intuitiveTitle)}
            score={session.intuitive_score || 0}
            color="yellow"
            description={isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_intuitive_desc${langKey}`, intuitiveDesc)}
                onSave={(value) => saveContent(`results_intuitive_desc${langKey}`, value)}
                as="span"
                className="text-sm text-gray-600"
              />
            ) : getContent(`results_intuitive_desc${langKey}`, intuitiveDesc)}
          />
        </div>

        {/* Profile Description */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mb-6">
          {isAdmin && isPreview ? (
            <EditableField
              value={getContent(`results_profile_heading${langKey}`, profileHeading)}
              onSave={(value) => saveContent(`results_profile_heading${langKey}`, value)}
              as="h3"
              className="text-lg font-semibold text-gray-900 mb-4"
            />
          ) : (
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{getContent(`results_profile_heading${langKey}`, profileHeading)}</h3>
          )}
          <p className="text-gray-600 leading-relaxed">
            {getProfileDescription(session, lang)}
          </p>
        </div>

        {/* Email confirmation */}
        {session.email && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3">
            <Mail className="w-5 h-5 text-green-600" />
            <div className="text-sm text-green-700">
              {isAdmin && isPreview ? (
                <EditableField
                  value={getContent(`results_email_sent${langKey}`, emailSentText)}
                  onSave={(value) => saveContent(`results_email_sent${langKey}`, value)}
                  as="span"
                  className="text-sm text-green-700"
                />
              ) : (
                getContent(`results_email_sent${langKey}`, emailSentText)
              )}{' '}
              <strong>{session.email}</strong>
            </div>
          </div>
        )}

        {/* Back to Home */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700"
          >
            {isAdmin && isPreview ? (
              <EditableField
                value={getContent(`results_take_another${langKey}`, takeAnotherText)}
                onSave={(value) => saveContent(`results_take_another${langKey}`, value)}
                as="span"
                className="text-white font-medium"
              />
            ) : (
              getContent(`results_take_another${langKey}`, takeAnotherText)
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

function DimensionCard({
  title,
  score,
  color,
  description
}: {
  title: React.ReactNode;
  score: number;
  color: 'blue' | 'purple' | 'green' | 'yellow';
  description: React.ReactNode;
}) {
  const colorClasses = {
    blue: 'border-blue-200 bg-blue-50',
    purple: 'border-purple-200 bg-purple-50',
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
  };

  const textClasses = {
    blue: 'text-blue-600',
    purple: 'text-purple-600',
    green: 'text-green-600',
    yellow: 'text-yellow-600',
  };

  return (
    <div className={`rounded-xl border-2 p-6 ${colorClasses[color]}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-gray-900">{title}</h4>
        <span className={`text-2xl font-bold ${textClasses[color]}`}>
          {Math.round(score)}%
        </span>
      </div>
      <div className="text-sm text-gray-600">{description}</div>
      <div className="mt-3 h-2 bg-white rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color === 'blue' ? 'bg-blue-500' :
            color === 'purple' ? 'bg-purple-500' :
              color === 'green' ? 'bg-green-500' :
                'bg-yellow-500'
            }`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function getScoreInterpretation(score: number, lang: string): string {
  if (lang === 'ru') {
    if (score >= 80) return 'Отлично! Ваши когнитивные способности высокоразвиты.';
    if (score >= 60) return 'Хороший результат! Ваши способности выше среднего.';
    if (score >= 40) return 'Средний результат. Есть потенциал для развития.';
    return 'Есть возможности для улучшения в этой области.';
  }
  if (score >= 80) return 'Excellent! Your cognitive abilities are highly developed.';
  if (score >= 60) return 'Good result! Your abilities are above average.';
  if (score >= 40) return 'Average result. There is potential for development.';
  return 'There are opportunities for improvement in this area.';
}

function getProfileDescription(session: TestSession, lang: string): string {
  const scores = [
    { name: lang === 'ru' ? 'Аналитик' : 'Analyst', key: 'analyst', score: session.analyst_score || 0 },
    { name: lang === 'ru' ? 'Стратег' : 'Strategist', key: 'strategist', score: session.strategist_score || 0 },
    { name: lang === 'ru' ? 'Наблюдатель' : 'Observer', key: 'observer', score: session.observer_score || 0 },
    { name: lang === 'ru' ? 'Интуит' : 'Intuitive', key: 'intuitive', score: session.intuitive_score || 0 },
  ];

  const strongest = scores.reduce((max, s) => s.score > max.score ? s : max);

  const descriptions: Record<string, { ru: string; en: string }> = {
    'analyst': {
      ru: 'Вы превосходно справляетесь с логическими задачами и анализом данных. Карьера в аналитике, программировании, науке и финансах вам подходит.',
      en: 'You excel at logical tasks and data analysis. Your approach to problem-solving is based on facts and rational thinking. Careers in analytics, programming, science, and finance suit you well.',
    },
    'strategist': {
      ru: 'Вы умеете планировать наперёд и видеть общую картину. Лидерство, управление проектами и бизнес-планирование — ваши сильные стороны.',
      en: 'You are skilled at planning ahead and seeing the big picture. Leadership positions, project management, and business planning are your strengths.',
    },
    'observer': {
      ru: 'У вас отличное пространственное мышление и внимание к деталям. Карьера в дизайне, архитектуре, инженерии и искусстве вам подходит.',
      en: 'You have excellent spatial thinking and attention to detail. Careers in design, architecture, engineering, and art suit you.',
    },
    'intuitive': {
      ru: 'Ваше творческое мышление позволяет находить нестандартные решения. Творческие профессии, инновации и предпринимательство — ваше призвание.',
      en: 'Your creative and associative thinking allows you to find unconventional solutions. Creative professions, innovation, and entrepreneurship are your calling.',
    },
  };

  const prefix = lang === 'ru' ? `Ваша сильнейшая сторона — ${strongest.name}. ` : `Your strongest dimension is ${strongest.name}. `;
  return prefix + descriptions[strongest.key][lang as 'ru' | 'en'];
}
