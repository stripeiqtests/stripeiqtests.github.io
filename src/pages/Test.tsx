import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Test as TestType, Question } from '../lib/supabase';
import { Brain, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { trackTestStart, trackTestComplete } from '../lib/analytics';

export function Test() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const [test, setTest] = useState<TestType | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (slug) {
      loadTest();
    }
  }, [slug]);

  async function loadTest() {
    // Load test by slug
    const { data: testData, error: testError } = await supabase
      .from('tests')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (testError || !testData) {
      navigate('/');
      return;
    }

    setTest(testData);

    // Load questions using the test's id
    const { data: questionsData, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', testData.id)
      .order('question_number', { ascending: true });

    if (!questionsError && questionsData) {
      setQuestions(questionsData);
      // Track test start event
      trackTestStart(testData.id, testData.title);
    }

    setLoading(false);
  }

  function handleAnswer(answer: string) {
    const questionId = questions[currentIndex].id;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    // Auto-advance to next question (unless it's the last one)
    if (currentIndex < questions.length - 1) {
      setTimeout(() => {
        setCurrentIndex(prev => prev + 1);
      }, 300); // Small delay for visual feedback
    }
  }

  async function handleSubmit() {
    if (!test) return;

    setSubmitting(true);

    // Create test session
    const { data: session, error: sessionError } = await supabase
      .from('test_sessions')
      .insert({
        test_id: test.id,
        email: email || null,
        answers: JSON.stringify(answers),
      })
      .select()
      .single();

    if (sessionError || !session) {
      setSubmitError(t('common.submit_error'));
      setSubmitting(false);
      return;
    }

    // Calculate scores
    const dimensionScores = {
      analyst: { correct: 0, total: 0 },
      strategist: { correct: 0, total: 0 },
      observer: { correct: 0, total: 0 },
      intuitive: { correct: 0, total: 0 },
    };

    questions.forEach(question => {
      const dimension = question.dimension;
      dimensionScores[dimension].total++;

      const userAnswer = answers[question.id];
      if (userAnswer === question.correct_answer) {
        dimensionScores[dimension].correct++;
      }
    });

    // Calculate percentage scores
    const analystScore = dimensionScores.analyst.total > 0
      ? (dimensionScores.analyst.correct / dimensionScores.analyst.total) * 100
      : 0;
    const strategistScore = dimensionScores.strategist.total > 0
      ? (dimensionScores.strategist.correct / dimensionScores.strategist.total) * 100
      : 0;
    const observerScore = dimensionScores.observer.total > 0
      ? (dimensionScores.observer.correct / dimensionScores.observer.total) * 100
      : 0;
    const intuitiveScore = dimensionScores.intuitive.total > 0
      ? (dimensionScores.intuitive.correct / dimensionScores.intuitive.total) * 100
      : 0;

    const overallScore = (analystScore + strategistScore + observerScore + intuitiveScore) / 4;

    // Update session with scores
    await supabase
      .from('test_sessions')
      .update({
        analyst_score: analystScore,
        strategist_score: strategistScore,
        observer_score: observerScore,
        intuitive_score: intuitiveScore,
        overall_score: overallScore,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    // Track test complete event
    trackTestComplete(test.id, test.title, questions.length);

    // Navigate to results page
    navigate(`/results/${session.id}`);
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

  // Email prompt (shown after all questions are answered)
  const allAnswered = Object.keys(answers).length === questions.length;

  if (showEmailPrompt && allAnswered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <Brain className="w-16 h-16 text-indigo-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900">
              {lang === 'ru' ? 'Тест завершён!' : 'Test Completed!'}
            </h1>
            <p className="text-gray-500 mt-2">
              {lang === 'ru' ? 'Введите email для получения результатов' : 'Enter your email to receive results'}
            </p>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.email_optional')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-400 mt-2">
              {t('common.email_hint')}
            </p>
          </div>

          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {submitError}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                {lang === 'ru' ? 'Отправка...' : 'Submitting...'}
              </span>
            ) : (
              lang === 'ru' ? 'Получить результаты' : 'Get Results'
            )}
          </button>

          <button
            onClick={() => setShowEmailPrompt(false)}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 py-2"
          >
            {lang === 'ru' ? 'Назад к вопросам' : 'Back to Questions'}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const options = (typeof currentQuestion.options === 'string'
    ? JSON.parse(currentQuestion.options)
    : currentQuestion.options) as { label: string; value: string }[];
  const selectedAnswer = answers[currentQuestion.id];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-20">
        <div
          className="h-full bg-indigo-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6 text-indigo-600" />
            <span className="font-medium text-gray-900">{test?.title}</span>
          </div>
          <span className="text-sm text-gray-500">
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </header>

      {/* Question */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Question Number & Dimension */}
          <div className="flex items-center gap-3 mb-6">
            <span className="text-lg font-bold text-indigo-600">
              {t('test.question')} {currentQuestion.question_number}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${currentQuestion.dimension === 'analyst' ? 'bg-blue-100 text-blue-700' :
              currentQuestion.dimension === 'strategist' ? 'bg-purple-100 text-purple-700' :
                currentQuestion.dimension === 'observer' ? 'bg-green-100 text-green-700' :
                  'bg-yellow-100 text-yellow-700'
              }`}>
              {currentQuestion.dimension}
            </span>
          </div>

          {/* Question Text */}
          <h2 className="text-xl text-gray-900 mb-6">
            {currentQuestion.question_text}
          </h2>

          {/* Options */}
          <div className="space-y-3">
            {options.map((option) => (
              <button
                key={option.label}
                onClick={() => handleAnswer(option.label)}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedAnswer === option.label
                  ? 'border-indigo-600 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${selectedAnswer === option.label
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                    }`}>
                    {option.label}
                  </span>
                  <span className="text-gray-700">{option.value}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Question Image - displayed after options */}
          {currentQuestion.image_url && (
            <div className="mt-6">
              <img
                src={currentQuestion.image_url}
                alt="Question"
                className="max-w-full h-auto rounded-lg border border-gray-200"
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-5 h-5" />
            {lang === 'ru' ? 'Назад' : 'Previous'}
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={() => setShowEmailPrompt(true)}
              disabled={!allAnswered}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-5 h-5" />
              {lang === 'ru' ? 'Завершить тест' : 'Submit Test'}
            </button>
          ) : (
            <button
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              {lang === 'ru' ? 'Далее' : 'Next'}
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Question Navigator */}
        <div className="mt-8 flex flex-wrap gap-2 justify-center">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setCurrentIndex(idx)}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${idx === currentIndex
                ? 'bg-indigo-600 text-white'
                : answers[q.id]
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
            >
              {idx + 1}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
