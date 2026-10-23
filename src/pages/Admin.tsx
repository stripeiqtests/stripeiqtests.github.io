import { useCallback, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { generateSlug } from '../lib/utils';
import type { Test, Question } from '../lib/supabase';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Brain, Lock, Plus, Edit2, Trash2, Save, X,
  Eye, EyeOff, ChevronDown, ChevronUp, ArrowLeft, FileText, Settings,
  Upload, Image, Link2
} from 'lucide-react';
import { useAdmin } from '../lib/AdminContext';
import { AdminPagesDashboard } from '../components/AdminPagesDashboard';
import { AdminArchetypesTab } from '../components/AdminArchetypesTab';
import { AdminSettingsTab } from '../components/AdminSettingsTab';
import { useLanguage, LanguageSwitcher } from '../lib/i18n';
import { parseOptions, validPrice, nextQuestionNumber } from '../lib/testData';
import {validateQuestionImage,ImageValidationError} from '../lib/questionUpload';

export function Admin() {
  const { isAdmin, authLoading, login, logout } = useAdmin();
  const { t, lang } = useLanguage();
  const [actionError, setActionError] = useState('');
  const [pendingAction, setPendingAction] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const actionLock = useRef(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const passwordDialog=useRef<HTMLDialogElement|null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdateError, setPasswordUpdateError] = useState('');
  const [passwordUpdateMessage, setPasswordUpdateMessage] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  // Test management state
  const [tests, setTests] = useState<Test[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question[]>>({});
  // Undefined follows the initial default; null preserves a manual collapse.
  const [expandedTest, setExpandedTest] = useState<string | null | undefined>();

  // Edit states
  const [searchParams, setSearchParams] = useSearchParams();
  const editingTestId = searchParams.get('editTest');
  function setEditingTest(testId: string | null) {
    setSearchParams(previous => {
      const next = new URLSearchParams(previous);
      if (testId) next.set('editTest', testId);
      else next.delete('editTest');
      return next;
    }, { replace: true });
  }
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [newTest, setNewTest] = useState(false);
  const [newQuestion, setNewQuestion] = useState<string | null>(null); // test_id for new question
  const location = useLocation();

  // Determine active tab from URL
  const getActiveTab = (): 'tests' | 'pages' | 'archetypes' | 'settings' => {
    const path = location.pathname;
    if (path.includes('/admin/pages')) return 'pages';
    if (path.includes('/admin/archetypes')) return 'archetypes';
    if (path.includes('/admin/settings')) return 'settings';
    return 'tests';
  };
  const activeTab = getActiveTab();
  const activeTests = tests.filter(test => test.is_active);
  const editTarget = tests.find(test => test.id === editingTestId);
  const expandedTestId = editTarget?.id ?? (expandedTest === undefined
    ? (activeTests.length === 1 ? activeTests[0].id : null)
    : expandedTest);

  const loadTests = useCallback(async () => {
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) setActionError(lang === 'ru' ? 'Не удалось загрузить тесты. Обновите страницу.' : 'Could not load tests. Please reload.');
    if (!error && data) {
      setTests(data);
    }
  }, [lang]);

  useEffect(() => {
    if (isAdmin) {
      // All state updates inside this callback follow the awaited HTTP response.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadTests();
    }
  }, [isAdmin, loadTests]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const loginError = await login(email.trim(), password);
    if (!loginError) {
      loadTests();
    } else {
      setError(loginError);
    }
    setLoading(false);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();
    setPasswordUpdateError('');
    setPasswordUpdateMessage('');

    if (newPassword.length < 12) {
      setPasswordUpdateError(t('admin.password_min_length'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordUpdateError(t('admin.passwords_do_not_match'));
      return;
    }

    setPasswordUpdating(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordUpdating(false);

    if (updateError) {
      setPasswordUpdateError(updateError.message);
      return;
    }

    setNewPassword('');
    setConfirmPassword('');
    setPasswordUpdateMessage(t('admin.password_updated'));
  }

  const loadQuestions = useCallback(async (testId: string) => {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', testId)
      .order('question_number', { ascending: true });

    if (!error && data) {
      setQuestions(prev => ({ ...prev, [testId]: data }));
    }
  }, []);

  useEffect(() => {
    if (isAdmin && activeTab === 'tests' && expandedTestId && !questions[expandedTestId]) {
      // All state updates inside this callback follow the awaited HTTP response.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadQuestions(expandedTestId);
    }
  }, [isAdmin, activeTab, expandedTestId, questions, loadQuestions]);

  async function toggleTestActive(test: Test) {
    if (test.archived_at) return;
    await runAction(async () => {
    const { error } = await supabase
      .from('tests')
      .update({ is_active: !test.is_active })
      .eq('id', test.id);

    if (error) throw error;
    await loadTests();
    });
  }

  async function runAction(action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true;
    setPendingAction(true); setActionError('');
    try { await action(); }
    catch (error) { setActionError(saveErrorMessage(error, lang)); }
    finally { actionLock.current = false; setPendingAction(false); }
  }

  async function saveTest(test: Partial<Test>) {
    const title = test.title?.trim() ?? '';
    if (!title || !validPrice(test.price_cents)) throw new Error(lang === 'ru' ? 'Укажите название и цену от $0.50 до $1000.' : 'Enter a title and a price between $0.50 and $1000.');
    const slug = generateSlug(title);
    if (!test.id && !slug) throw new Error(lang === 'ru' ? 'Название должно содержать буквы или цифры.' : 'The title must contain letters or numbers.');

    if (test.id) {
      // Update existing
      const { error } = await supabase
        .from('tests')
        .update({
          title,
          description: test.description,
          price_cents: test.price_cents,
        })
        .eq('id', test.id);

      if (error) throw error;
      if (!error) {
        setEditingTest(null);
        loadTests();
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('tests')
        .insert({
          title,
          slug: slug,
          description: test.description,
          price_cents: test.price_cents,
          is_active: false,
        });

      if (error) throw error;
      if (!error) {
        setNewTest(false);
        loadTests();
      }
    }
  }

  async function archiveTest(test: Test) {
    const restore = Boolean(test.archived_at);
    if (!restore && !confirm(lang === 'ru' ? 'Архивировать тест? Вопросы и результаты сохранятся; начать новую попытку будет нельзя.' : 'Archive this test? Questions and results are kept; new attempts will be unavailable.')) return;
    await runAction(async () => {
      const { error } = await supabase.from('tests')
        .update({ archived_at: restore ? null : new Date().toISOString(), is_active: false }).eq('id', test.id);
      if (error) throw error;
      await loadTests();
    });
  }

  async function saveQuestion(question: Partial<Question>, testId: string) {
    if (!question.question_text?.trim() || !Number.isInteger(question.question_number) || (question.question_number ?? 0) < 1) {
      throw new Error(lang === 'ru' ? 'Введите текст и положительный целый номер вопроса.' : 'Enter question text and a positive whole question number.');
    }
    let parsed;
    try { parsed = parseOptions(question.options); }
    catch { throw new Error(lang === 'ru' ? 'Заполните все варианты ответа. Обозначения должны быть уникальны.' : 'Fill every answer option. Labels must be unique.'); }
    if (!parsed.some(option => option.label === question.correct_answer)) throw new Error(lang === 'ru' ? 'Выберите правильный ответ из вариантов.' : 'Select a correct answer from the options.');
    if ((questions[testId] ?? []).some(q => q.id !== question.id && q.question_number === question.question_number)) throw new Error(lang === 'ru' ? 'Вопрос с таким номером уже есть.' : 'This question number is already in use.');
    if (question.id) {
      // Update existing
      const { error } = await supabase
        .from('questions')
        .update({
          question_number: question.question_number,
          question_text: question.question_text.trim(),
          image_url: question.image_url,
          options: question.options,
          correct_answer: question.correct_answer,
          dimension: question.dimension,
        })
        .eq('id', question.id);

      if (error) throw error;
      if (!error) {
        setEditingQuestion(null);
        loadQuestions(testId);
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('questions')
        .insert({
          test_id: testId,
          question_number: question.question_number,
          question_text: question.question_text.trim(),
          image_url: question.image_url,
          options: question.options,
          correct_answer: question.correct_answer,
          dimension: question.dimension,
        });

      if (error) throw error;
      if (!error) {
        setNewQuestion(null);
        loadQuestions(testId);
      }
    }
  }

  async function deleteQuestion(questionId: string, testId: string) {
    if (!confirm(lang === 'ru' ? 'Удалить этот вопрос?' : 'Delete this question?')) return;

    await runAction(async () => {
    const { error } = await supabase.from('questions').delete().eq('id', questionId);
    if (error) throw error;
    await loadQuestions(testId);
    });
  }

  function handleExpandTest(testId: string) {
    if (expandedTestId === testId) {
      setExpandedTest(null);
    } else {
      setExpandedTest(testId);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    );
  }

  // Login form
  if (!isAdmin) {
    return (
      <div role="main" className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
            <p className="text-gray-500 mt-2">Sign in with an administrator account</p>
          </div>

          <form onSubmit={handleLogin}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="username"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              autoFocus
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
            />

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Login'}
            </button>
          </form>

          <Link
            to="/"
            className="block text-center mt-6 text-sm text-gray-500 hover:text-gray-700"
          >
            {t('admin.back_home')}
          </Link>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/" aria-label={t('admin.back_home')} className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-600" />
              <h1 className="font-bold text-gray-900">{t('admin.panel')}</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <button
              onClick={() => {
                setPasswordUpdateError('');
                setPasswordUpdateMessage('');
                setShowPasswordDialog(true);
              }}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700"
            >
              <Lock className="w-4 h-4" />
              {t('admin.set_password')}
            </button>
            <button
              onClick={() => {
                logout();
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              {t('admin.logout')}
            </button>
          </div>
        </div>
      </header>

      {showPasswordDialog && (
          <dialog
            ref={node=>{passwordDialog.current=node;if(node&&!node.open)node.showModal();}}
            aria-labelledby="password-dialog-title"
            onClose={()=>setShowPasswordDialog(false)}
            onCancel={event=>{if(passwordUpdating)event.preventDefault();}}
            className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-6 shadow-xl backdrop:bg-black/40"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 id="password-dialog-title" className="text-xl font-semibold text-gray-900">
                {t('admin.set_password_title')}
              </h2>
              <button
                type="button"
                aria-label={t('admin.cancel')}
                disabled={passwordUpdating}
                onClick={() => passwordDialog.current?.close()}
                className="rounded-lg p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <input
                type="password"
                aria-label={t('admin.new_password')}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder={t('admin.new_password')}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <input
                type="password"
                aria-label={t('admin.confirm_password')}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder={t('admin.confirm_password')}
                autoComplete="new-password"
                className="w-full rounded-lg border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />

              {passwordUpdateError && (
                <p className="text-sm text-red-600">{passwordUpdateError}</p>
              )}
              {passwordUpdateMessage && (
                <p className="text-sm text-green-600">{passwordUpdateMessage}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={passwordUpdating}
                  onClick={() => passwordDialog.current?.close()}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  {t('admin.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={passwordUpdating || !newPassword || !confirmPassword}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {passwordUpdating ? t('admin.saving') : t('admin.set_password')}
                </button>
              </div>
            </form>
          </dialog>
      )}

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <Link
            to="/admin/tests"
            className={`pb-3 px-1 font-medium transition-colors relative ${activeTab === 'tests'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('admin.manage_tests')}
            </span>
          </Link>
          <Link
            to="/admin/archetypes"
            className={`pb-3 px-1 font-medium transition-colors relative ${activeTab === 'archetypes'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="flex items-center gap-2">
              <Brain className="w-4 h-4" />
              {t('admin.archetypes') || 'Archetypes'}
            </span>
          </Link>
          <Link
            to="/admin/pages"
            className={`pb-3 px-1 font-medium transition-colors relative ${activeTab === 'pages'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              {t('admin.page_content')}
            </span>
          </Link>
          <Link
            to="/admin/settings"
            className={`pb-3 px-1 font-medium transition-colors relative ${activeTab === 'settings'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('admin.settings') || 'Settings'}
            </span>
          </Link>
        </div>

        {/* Page Content Tab */}
        {activeTab === 'pages' && <AdminPagesDashboard />}

        {/* Archetypes Tab */}
        {activeTab === 'archetypes' && <AdminArchetypesTab />}

        {/* Settings Tab */}
        {activeTab === 'settings' && <AdminSettingsTab tests={tests} />}

        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <>
            {actionError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{actionError}</p>}
            <label className="mb-4 flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />{lang === 'ru' ? 'Показать архив' : 'Show archived tests'}</label>
            {/* Tests Section */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-gray-900">{t('admin.manage_tests')}</h2>
              <button
                onClick={() => setNewTest(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('admin.new_test')}
              </button>
            </div>

            {/* New Test Form */}
            {newTest && (
              <TestForm
                onSave={(test) => saveTest(test)}
                onCancel={() => setNewTest(false)}
              />
            )}

            {/* Tests List */}
            <div className="space-y-4">
              {tests.filter(test => showArchived || !test.archived_at).map((test) => (
                <div key={test.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Test Header */}
                  {editingTestId === test.id ? (
                    <TestForm
                      test={test}
                      onSave={(t) => saveTest(t)}
                      onCancel={() => setEditingTest(null)}
                    />
                  ) : (
                    <div className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-semibold text-gray-900">{test.title}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${test.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                              }`}>
                              {test.is_active ? t('admin.active') : t('admin.inactive')}
                            </span>
                          </div>
                          <p className="text-gray-500 text-sm mt-1">{test.description}</p>
                          <p className="text-sm text-gray-600 mt-2">
                            {t('admin.price')}: <span className="font-semibold">${(test.price_cents / 100).toFixed(2)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            disabled={pendingAction || Boolean(test.archived_at)}
                            onClick={() => toggleTestActive(test)}
                            className={`p-2 rounded-lg transition-colors ${test.is_active
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-gray-400 hover:bg-gray-50'
                              }`}
                            title={test.is_active ? t('admin.deactivate') : t('admin.activate')}
                          >
                            {test.is_active ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                          </button>
                          <button
                            onClick={() => setEditingTest(test.id)}
                            className="p-2 text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                            title={t('admin.edit')}
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            disabled={pendingAction}
                            onClick={() => archiveTest(test)}
                            className="p-2 text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title={test.archived_at ? (lang === 'ru' ? 'Восстановить из архива' : 'Restore from archive') : (lang === 'ru' ? 'Архивировать тест' : 'Archive test')}
                          >
                            <span className="text-xs font-medium">{test.archived_at ? (lang === 'ru' ? 'Вернуть' : 'Restore') : (lang === 'ru' ? 'В архив' : 'Archive')}</span>
                          </button>
                          <button
                            onClick={() => handleExpandTest(test.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                            title={t('admin.questions')}
                            aria-expanded={expandedTestId === test.id}
                            aria-controls={`test-questions-${test.id}`}
                          >
                            {expandedTestId === test.id ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Questions Section */}
                  {expandedTestId === test.id && (
                    <div id={`test-questions-${test.id}`} className="border-t border-gray-200 bg-gray-50 p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h4 className="font-medium text-gray-700">{t('admin.questions')} ({questions[test.id]?.length || 0})</h4>
                        <button
                          onClick={() => setNewQuestion(test.id)}
                          className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                        >
                          <Plus className="w-4 h-4" />
                          {t('admin.add_question')}
                        </button>
                      </div>

                      {/* New Question Form */}
                      {newQuestion === test.id && (
                        <QuestionForm
                          questionNumber={nextQuestionNumber(questions[test.id] ?? [])}
                          onSave={(q) => saveQuestion(q, test.id)}
                          onCancel={() => setNewQuestion(null)}
                        />
                      )}

                      {/* Questions List */}
                      <div className="space-y-2">
                        {questions[test.id]?.map((question) => (
                          <div key={question.id}>
                            {editingQuestion?.id === question.id ? (
                              <QuestionForm
                                question={question}
                                questionNumber={question.question_number}
                                onSave={(q) => saveQuestion(q, test.id)}
                                onCancel={() => setEditingQuestion(null)}
                              />
                            ) : (
                              <div className="bg-white rounded-lg p-3 border border-gray-200 flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-500">#{question.question_number}</span>
                                    <span className={`px-2 py-0.5 rounded text-xs ${question.dimension === 'analyst' ? 'bg-blue-100 text-blue-700' :
                                      question.dimension === 'strategist' ? 'bg-purple-100 text-purple-700' :
                                        question.dimension === 'observer' ? 'bg-green-100 text-green-700' :
                                          'bg-yellow-100 text-yellow-700'
                                      }`}>
                                      {question.dimension}
                                    </span>
                                  </div>
                                  <p className="text-sm text-gray-700 mt-1">{question.question_text}</p>
                                  {question.image_url && (
                                    <p className="text-xs text-gray-400 mt-1">Has image</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setEditingQuestion(question)}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded"
                                    title={t('admin.edit')}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteQuestion(question.id, test.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
                                    title={t('admin.delete')}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {tests.length === 0 && !newTest && (
              <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
                <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">{t('admin.no_tests')}</p>
                <button
                  onClick={() => setNewTest(true)}
                  className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  {t('admin.create_first')}
                </button>
              </div>
            )}
          </>
        )}



      </main>
    </div>
  );
}

// Test Form Component
function TestForm({
  test,
  onSave,
  onCancel
}: {
  test?: Test;
  onSave: (test: Partial<Test>) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, lang } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLock = useRef(false);
  const [title, setTitle] = useState(test?.title || '');
  const [description, setDescription] = useState(test?.description || '');
  const [price, setPrice] = useState(test ? (test.price_cents / 100).toString() : '5');

  return (
    <form className="bg-indigo-50 p-4 rounded-lg border border-indigo-200" onSubmit={async event => {
      event.preventDefault(); if (saveLock.current) return;
      saveLock.current = true; setSaving(true); setSaveError('');
      try { await onSave({ id: test?.id, title: title.trim(), description, price_cents: Math.round(Number(price) * 100) }); }
      catch (error) { setSaveError(saveErrorMessage(error, lang)); }
      finally { saveLock.current = false; setSaving(false); }
    }}>
      <fieldset disabled={saving}>
      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('admin.test_title')}
          aria-label={t('admin.test_title')}
          autoFocus
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('admin.test_description')}
          aria-label={t('admin.test_description')}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{t('admin.price')}: $</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0.50"
            max="1000"
            required
            aria-label={t('admin.price')}
            step="0.01"
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          aria-label={t('admin.cancel')}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          type="submit"
          disabled={saving || !title.trim() || !validPrice(Math.round(Number(price) * 100))}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? (lang === 'ru' ? 'Сохранение…' : 'Saving…') : t('admin.save')}
        </button>
      </div>
      {saveError && <p role="alert" className="mt-3 text-red-800">{saveError}</p>}
      </fieldset>
    </form>
  );
}

// Question Form Component
function QuestionForm({
  question,
  questionNumber,
  onSave,
  onCancel
}: {
  question?: Question;
  questionNumber: number;
  onSave: (question: Partial<Question>) => Promise<void>;
  onCancel: () => void;
}) {
  const { t, lang } = useLanguage();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const saveLock = useRef(false);
  const [qNumber, setQNumber] = useState(question?.question_number || questionNumber);
  const [text, setText] = useState(question?.question_text || '');
  const [imageUrl, setImageUrl] = useState(question?.image_url || '');
  const [useUrlInput, setUseUrlInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError,setUploadError]=useState('');
  const ownUploads=useRef(new Map<string,string>());
  const protectedUploads=useRef(new Set<string>());
  const formMounted=useRef(true);
  useEffect(()=>{
    formMounted.current=true;
    const owned=ownUploads.current,protectedPaths=protectedUploads.current;
    return ()=>{
      formMounted.current=false;
      const discarded=[...owned.keys()].filter(path=>!protectedPaths.has(path));
      if(discarded.length)void discardNewImages(discarded);
    };
  },[]);
  const [options, setOptions] = useState<{ label: string; value: string }[]>(() => {
    if (!question?.options) {
      return [
        { label: 'A', value: '' },
        { label: 'B', value: '' },
        { label: 'C', value: '' },
        { label: 'D', value: '' },
      ];
    }
    // Handle both string and already-parsed object
    if (typeof question.options === 'string') {
      try {
        return JSON.parse(question.options);
      } catch {
        return [
          { label: 'A', value: '' },
          { label: 'B', value: '' },
          { label: 'C', value: '' },
          { label: 'D', value: '' },
        ];
      }
    }
    return question.options;
  });
  const [correctAnswer, setCorrectAnswer] = useState(question?.correct_answer || 'A');
  const [dimension, setDimension] = useState<Question['dimension']>(question?.dimension || 'analyst');

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value='';
    setUploadError('');
    setUploading(true);
    let filePath:string|null=null;
    try {
      const format=await validateQuestionImage(file);
      if(!formMounted.current)return;
      filePath=`questions/${crypto.randomUUID()}.${format.extension}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file,{contentType:format.contentType,upsert:false});

      if (uploadError) {
        throw uploadError;
      }

      if(!formMounted.current){await discardNewImages([filePath]);return;}

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      ownUploads.current.set(filePath,publicUrl);
      setImageUrl(publicUrl);
    } catch (error) {
      // A failed upload may have reached Storage. This unique path was never
      // offered to the save handler; it is safe to discard if it exists.
      if(filePath)await discardNewImages([filePath]);
      if(formMounted.current){
        const ru=lang==='ru';
        const messages={format:ru?'Поддерживаются PNG, JPEG, GIF и WebP. Проверьте формат файла.':'Use a PNG, JPEG, GIF or WebP file.',
          size:ru?'Выберите непустое изображение размером до 5 МБ.':'Choose a non-empty image up to 5 MB.',
          decode:ru?'Не удалось прочитать изображение. Сохраните его заново и повторите загрузку.':'The image could not be decoded. Export it again and retry.',
          dimensions:ru?'Изображение слишком большое: максимум 8000 пикселей по стороне и 40 мегапикселей.':'Use an image no larger than 8000 pixels per side and 40 megapixels.'};
        setUploadError(error instanceof ImageValidationError?messages[error.code]:ru?'Не удалось загрузить изображение. Проверьте подключение и повторите: текст вопроса остаётся в форме.':'The image could not upload. Check your connection and retry; your question text stays in the form.');
      }
    } finally {
      if(formMounted.current)setUploading(false);
    }
  }

  function handleRemoveImage() {
    setImageUrl('');
  }

  return (
    <form className="bg-white p-4 rounded-lg border border-indigo-200 mb-2" onSubmit={async event => {
      event.preventDefault(); if (saveLock.current || uploading) return;
      saveLock.current = true; setSaving(true); setSaveError('');
      // The parent unmounts this form after a successful write. Protect the
      // chosen upload BEFORE awaiting it. On an ambiguous network failure keep
      // it too: leaking a temporary file is safer than deleting a saved image.
      for(const [path,url] of ownUploads.current)if(url===imageUrl)protectedUploads.current.add(path);
      try { await onSave({ id: question?.id, question_number: qNumber, question_text: text.trim(), image_url: imageUrl || null, options: JSON.stringify(options), correct_answer: correctAnswer, dimension }); }
      catch (error) { setSaveError(saveErrorMessage(error, lang)); }
      finally { saveLock.current = false; setSaving(false); }
    }}>
      <fieldset disabled={saving}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">{t('admin.question_num')}</label>
          <input
            type="number"
            min="1"
            step="1"
            required
            aria-label={t('admin.question_num')}
            value={qNumber}
            onChange={(e) => setQNumber(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('admin.dimension')}</label>
          <select
            aria-label={t('admin.dimension')}
            value={dimension}
            onChange={(e) => setDimension(e.target.value as Question['dimension'])}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          >
            <option value="analyst">{t('admin.analyst')}</option>
            <option value="strategist">{t('admin.strategist')}</option>
            <option value="observer">{t('admin.observer')}</option>
            <option value="intuitive">{t('admin.intuitive')}</option>
          </select>
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs text-gray-500">{t('admin.question_text')}</label>
        <textarea
          aria-label={t('admin.question_text')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      {/* Image Section */}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500">
            {lang === 'ru' ? 'Изображение (опционально)' : 'Image (optional)'}
          </label>
          <button
            type="button"
            onClick={() => setUseUrlInput(!useUrlInput)}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            {useUrlInput ? (
              <>
                <Upload className="w-3 h-3" />
                {lang === 'ru' ? 'Загрузить файл' : 'Upload file'}
              </>
            ) : (
              <>
                <Link2 className="w-3 h-3" />
                {lang === 'ru' ? 'Ввести URL' : 'Enter URL'}
              </>
            )}
          </button>
        </div>

        {/* Image Preview */}
        {imageUrl && (
          <div className="mb-2 relative inline-block">
            <img
              src={imageUrl}
              alt="Preview"
              className="max-h-32 rounded-lg border border-gray-200"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              aria-label={lang==='ru'?'Убрать изображение':'Remove image'}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {useUrlInput ? (
          /* URL Input */
          <input
            type="text"
            value={imageUrl}
            aria-label={t('admin.image_url')}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        ) : (
          /* File Upload */
          <div className="flex items-center gap-2">
            <label className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 focus-within:ring-2 focus-within:ring-indigo-600 transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                aria-label={lang==='ru'?'Загрузить изображение':'Upload image'}
                onChange={handleImageUpload}
                disabled={uploading}
                className="sr-only"
              />
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                  <span className="text-sm text-gray-500">
                    {lang === 'ru' ? 'Загрузка...' : 'Uploading...'}
                  </span>
                </>
              ) : (
                <>
                  <Image className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {lang === 'ru' ? 'Нажмите для загрузки изображения' : 'Click to upload image'}
                  </span>
                </>
              )}
            </label>
          </div>
        )}
      </div>

      {uploadError&&<p role="alert" className="mt-2 text-sm text-red-800">{uploadError}</p>}
      <p className="mt-2 text-xs text-gray-600">{lang==='ru'?'PNG, JPEG, GIF или WebP; до 5 МБ, 8000 пикселей по стороне и 40 Мп.':'PNG, JPEG, GIF or WebP; up to 5 MB, 8000 pixels per side and 40 MP.'}</p>

      <div className="mt-3">
        <label className="text-xs text-gray-500">{t('admin.options')}</label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-sm font-medium w-6">{opt.label}:</span>
              <input
                type="text"
                aria-label={`${t('admin.options')}: ${opt.label}`}
                value={opt.value}
                onChange={(e) => {
                  const newOptions = [...options];
                  newOptions[idx].value = e.target.value;
                  setOptions(newOptions);
                }}
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs text-gray-500">{t('admin.correct_answer')}</label>
        <select
          aria-label={t('admin.correct_answer')}
          value={correctAnswer}
          onChange={(e) => setCorrectAnswer(e.target.value)}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          {options.map((opt) => (
            <option key={opt.label} value={opt.label}>{opt.label}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button type="button" disabled={uploading} onClick={onCancel} className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm">
          {t('admin.cancel')}
        </button>
        <button
          type="submit"
          disabled={saving || uploading || !text.trim() || options.some(option => !option.value.trim()) || !Number.isInteger(qNumber) || qNumber < 1}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {saving ? (lang === 'ru' ? 'Сохранение…' : 'Saving…') : t('admin.save')}
        </button>
      </div>
      {saveError && <p role="alert" className="mt-3 text-red-800">{saveError}</p>}
      </fieldset>
    </form>
  );
}

function saveErrorMessage(error: unknown, lang: string): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === '23505') return lang === 'ru' ? 'Такой номер или адрес уже занят. Измените значение.' : 'This number or address is already in use.';
  if (code === '42501') return lang === 'ru' ? 'Недостаточно прав. Войдите заново под администратором.' : 'Permission denied. Sign in again as an administrator.';
  if (error instanceof Error) return error.message;
  return lang === 'ru' ? 'Не удалось сохранить изменения. Проверьте подключение и попробуйте ещё раз.' : 'Could not save changes. Check your connection and retry.';
}

async function discardNewImages(paths:string[]) {
  if(!paths.length||paths.some(path=>!/^questions\/[0-9a-f-]{36}\.(png|jpg|gif|webp)$/.test(path)))return;
  try{const {error}=await supabase.storage.from('images').remove(paths);if(error)console.warn('Discarded image cleanup deferred');}
  catch{console.warn('Discarded image cleanup deferred');}
}
