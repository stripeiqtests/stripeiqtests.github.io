import { useCallback, useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Test as TestType, PublicQuestion } from '../lib/supabase';
import { Brain, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { trackTestStart, trackTestComplete } from '../lib/analytics';
import { getQuestionImageUrls } from '../lib/questionImages';
import { resultPath, storeSessionAccess } from '../lib/sessionAccess';
import { parseOptions } from '../lib/testData';
import { readDraft, writeDraft, clearDraft, questionFingerprint, type TestDraft } from '../lib/testDraft';
import { QuestionImage } from '../components/QuestionImage';

export function Test() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const [test, setTest] = useState<TestType | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [email, setEmail] = useState('');
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [canPersist, setCanPersist] = useState(true);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draft = useRef<TestDraft | null>(null);
  const submitLock = useRef(false);
  const requestId = useRef(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);

  const cancelAdvance = useCallback(() => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    advanceTimer.current = null;
  }, []);
  const invalidateLoad = useCallback(() => { requestId.current++; cancelAdvance(); }, [cancelAdvance]);

  const loadTest = useCallback(async () => {
    const request = ++requestId.current;
    cancelAdvance();
    setLoading(true);
    setLoadError(false);
    try {
    const { data: testData, error: testError } = await supabase
      .from('tests')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (request !== requestId.current) return;
    if (testError) throw testError;
    if (!testData) {
      setTest(null);
      setQuestions([]);
      return;
    }

    setTest(testData);

    // Load questions using the test's id
    const { data: questionsData, error: questionsError } = await supabase
      .rpc('get_public_questions', { p_test_id: testData.id });

    if (request !== requestId.current) return;
    if (questionsError || !Array.isArray(questionsData)) throw questionsError ?? new Error('Invalid question data');
    const loaded = questionsData as PublicQuestion[];
    loaded.forEach(q => { parseOptions(q.options); if (!q.id || typeof q.question_text !== 'string') throw new Error('Invalid question'); });
    const fingerprint = questionFingerprint(loaded);
    const saved = readDraft(testData.id, fingerprint);
    const validAnswers = Object.fromEntries(Object.entries(saved?.answers ?? {}).filter(([id, answer]) =>
      loaded.some(q => q.id === id && parseOptions(q.options).some(option => option.label === answer))));
    draft.current = saved ? { ...saved, answers: validAnswers } : {
      attemptId: crypto.randomUUID(), fingerprint, answers: {}, currentIndex: 0, updatedAt: Date.now(),
    };
    setQuestions(loaded);
    setAnswers(validAnswers);
    setCurrentIndex(Math.min(saved?.currentIndex ?? 0, Math.max(0, loaded.length - 1)));
    setResumed(Object.keys(validAnswers).length > 0);
    setShowEmailPrompt(false);
    } catch { if (request === requestId.current) setLoadError(true); }
    finally { if (request === requestId.current) setLoading(false); }
  }, [slug, cancelAdvance]);

  useEffect(() => {
    if (slug) {
      // Data is loaded asynchronously; the state update occurs after the request.
      // This also resets loading when the route changes; retries reuse the same loader.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadTest();
    }
    return invalidateLoad;
  }, [loadTest, slug, invalidateLoad]);

  useEffect(() => {
    if (!test || !draft.current || loading || loadError) return;
    draft.current = { ...draft.current, answers, currentIndex, updatedAt: Date.now() };
    const persisted = writeDraft(test.id, draft.current);
    setCanPersist(persisted);
  }, [answers, currentIndex, test, loading, loadError]);

  useEffect(() => {
    if (!loading && !showEmailPrompt) {
      questionHeading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [currentIndex, loading, showEmailPrompt]);

  function goTo(index: number) {
    cancelAdvance();
    setCurrentIndex(Math.max(0, Math.min(questions.length - 1, index)));
  }

  function restart() {
    cancelAdvance();
    if (test) clearDraft(test.id);
    if (draft.current) draft.current = { ...draft.current, attemptId: crypto.randomUUID(), answers: {}, currentIndex: 0, updatedAt: Date.now() };
    setAnswers({}); setCurrentIndex(0); setEmail(''); setResumed(false); setShowEmailPrompt(false);
  }

  function handleAnswer(answer: string) {
    const question = questions[currentIndex];
    if (!question) return;
    cancelAdvance();
    const questionId = question.id;
    if (!Object.keys(answers).length) trackTestStart(test!.id, test!.title);
    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    // Auto-advance to next question (unless it's the last one)
    if (currentIndex < questions.length - 1) {
      const answeredIndex = currentIndex;
      advanceTimer.current = setTimeout(() => {
        setCurrentIndex(index => index === answeredIndex ? Math.min(index + 1, questions.length - 1) : index);
        advanceTimer.current = null;
      }, 300); // Small delay for visual feedback
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!test || submitLock.current || !questions.every(q => answers[q.id])) return;

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    cancelAdvance();
    try {

    // Score and create the protected session at the database boundary.
    const { data: rawSession, error: sessionError } = await supabase
      .rpc('submit_test_session', {
        p_test_id: test.id,
        p_email: email.trim() || null,
        p_answers: answers,
      })
      .single();

    const session = rawSession as { session_id: string; access_token: string } | null;

    if (sessionError || !session) {
      throw sessionError ?? new Error('Missing session');
    }

    const sessionId = session.session_id;
    const accessToken = session.access_token;
    storeSessionAccess(sessionId, accessToken);
    clearDraft(test.id);

    // Track test complete event
    trackTestComplete(test.id, test.title, questions.length);

    navigate(resultPath(sessionId, accessToken));
    } catch { setSubmitError(t('common.submit_error')); }
    finally { submitLock.current = false; setSubmitting(false); }
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
  const allAnswered = questions.length > 0 && questions.every(q => Boolean(answers[q.id]));

  if (showEmailPrompt && allAnswered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md" aria-busy={submitting}>
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
            <label htmlFor="result-email" className="block text-sm font-medium text-gray-700 mb-2">
              {t('common.email_optional')}
            </label>
            <input
              type="email"
              id="result-email"
              maxLength={320}
              autoComplete="email"
              disabled={submitting}
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
            type="submit"
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
            type="button"
            disabled={submitting}
            onClick={() => setShowEmailPrompt(false)}
            className="w-full mt-3 text-gray-500 hover:text-gray-700 py-2"
          >
            {lang === 'ru' ? 'Назад к вопросам' : 'Back to Questions'}
          </button>
        </form>
      </div>
    );
  }

  if (loadError || !test || questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-amber-200 bg-white p-8 text-center shadow-sm">
          <Brain className="mx-auto mb-4 h-12 w-12 text-amber-500" />
          <h1 className="text-xl font-bold text-gray-900">
            {loadError ? (lang === 'ru' ? 'Не удалось загрузить тест' : 'Could not load the test') : (lang === 'ru' ? 'Вопросы пока недоступны' : 'Questions are not available yet')}
          </h1>
          <p className="mt-2 text-gray-500">
            {loadError ? (lang === 'ru' ? 'Проверьте подключение и попробуйте ещё раз. Сохранённые ответы останутся в браузере.' : 'Check your connection and retry. Saved answers remain in this browser.') : lang === 'ru'
              ? 'Этот тест ещё не заполнен. Вернитесь на главную и выберите другой тест.'
              : 'This test has not been populated yet. Return home and choose another test.'}
          </p>
          {loadError && <button className="mt-4 mr-3 rounded-lg border border-indigo-600 px-5 py-3 text-indigo-700" onClick={() => void loadTest()}>{lang === 'ru' ? 'Повторить' : 'Retry'}</button>}
          <button
            onClick={() => navigate('/')}
            className="mt-6 rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white hover:bg-indigo-700"
          >
            {lang === 'ru' ? 'На главную' : 'Back home'}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[Math.min(currentIndex, questions.length - 1)];
  const options = parseOptions(currentQuestion.options);
  const selectedAnswer = answers[currentQuestion.id];
  const answeredCount = questions.filter(q => answers[q.id]).length;
  const progress = (answeredCount / questions.length) * 100;
  const questionImageUrls = getQuestionImageUrls(currentQuestion);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Progress Bar */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gray-200 z-20" role="progressbar" aria-label={lang === 'ru' ? 'Отвечено вопросов' : 'Questions answered'} aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount}>
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
        {resumed && <div role="status" className="mb-4 flex flex-wrap justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-900"><span>{lang === 'ru' ? 'Сохранённые ответы восстановлены.' : 'Your saved answers have been restored.'}</span><button onClick={restart} className="text-indigo-800 underline">{lang === 'ru' ? 'Начать заново' : 'Start again'}</button></div>}
        {!canPersist && <p role="status" className="mb-4 rounded-lg bg-amber-50 p-3 text-amber-900">{lang === 'ru' ? 'Браузер не разрешает сохранять черновик. Не закрывайте страницу до завершения теста.' : 'Draft storage is disabled. Keep this page open until you finish.'}</p>}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 sm:p-8">
          {/* Question Number */}
          <div className="mb-6">
            <span className="text-lg font-bold text-indigo-600" aria-live="polite">
              {t('test.question')} {currentQuestion.question_number}
            </span>
          </div>

          {/* Question Text */}
          <h2 ref={questionHeading} tabIndex={-1} className="text-xl text-gray-900 mb-6 whitespace-pre-line focus:outline-none">
            {currentQuestion.question_text.replace(/\\n/g, '\n')}
          </h2>

          {questionImageUrls.length > 0 && (
            <div className="mb-6 space-y-4">
              {questionImageUrls.map((imageUrl, index) => (
                <QuestionImage
                  key={imageUrl}
                  url={imageUrl}
                  alt={`${lang === 'ru' ? 'Иллюстрация к вопросу' : 'Question illustration'} ${currentQuestion.question_number}${questionImageUrls.length > 1 ? ` (${index + 1}/${questionImageUrls.length})` : ''}`}
                />
              ))}
            </div>
          )}

          {/* Options */}
          <div className="space-y-3" role="group" aria-label={lang === 'ru' ? 'Варианты ответа' : 'Answer options'}>
            {options.map((option) => (
              <button
                key={option.label}
                onClick={() => handleAnswer(option.label)}
                aria-pressed={selectedAnswer === option.label}
                className={`w-full text-left p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedAnswer === option.label
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

        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
            {lang === 'ru' ? 'Назад' : 'Previous'}
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={() => { cancelAdvance(); if (allAnswered) setShowEmailPrompt(true); else goTo(questions.findIndex(q => !answers[q.id])); }}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Check className="w-5 h-5" />
              {allAnswered ? (lang === 'ru' ? 'Завершить тест' : 'Submit Test') : (lang === 'ru' ? 'К пропущенным' : 'Unanswered')}
            </button>
          ) : (
            <button
              onClick={() => goTo(currentIndex + 1)}
              className="flex items-center gap-2 px-4 py-2 text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"
            >
              {lang === 'ru' ? 'Далее' : 'Next'}
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Question Navigator */}
        <p className="mt-6 text-center text-sm text-gray-700" role="status">{lang === 'ru' ? `Отвечено ${answeredCount} из ${questions.length}` : `${answeredCount} of ${questions.length} answered`}</p>
        <nav aria-label={lang === 'ru' ? 'Вопросы теста' : 'Test questions'} className="mt-3 flex flex-wrap gap-2 justify-center">
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => goTo(idx)}
              aria-current={idx === currentIndex ? 'step' : undefined}
              aria-label={`${lang === 'ru' ? 'Вопрос' : 'Question'} ${idx + 1}: ${answers[q.id] ? (lang === 'ru' ? 'есть ответ' : 'answered') : (lang === 'ru' ? 'нет ответа' : 'unanswered')}`}
              className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors cursor-pointer ${idx === currentIndex
                ? 'bg-indigo-600 text-white'
                : answers[q.id]
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {idx + 1}
            </button>
          ))}
        </nav>
      </main>
    </div>
  );
}
