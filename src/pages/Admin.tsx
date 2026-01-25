import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateSlug } from '../lib/utils';
import type { Test, Question } from '../lib/supabase';
import { Link, useLocation } from 'react-router-dom';
import {
  Brain, Lock, Plus, Edit2, Trash2, Save, X,
  Eye, EyeOff, ChevronDown, ChevronUp, ArrowLeft, FileText, Settings
} from 'lucide-react';
import { useAdmin } from '../lib/AdminContext';
import { PageContentEditor } from '../components/PageContentEditor';
import { useLanguage, LanguageSwitcher } from '../lib/i18n';

export function Admin() {
  const { isAdmin, setIsAdmin, logout } = useAdmin();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Test management state
  const [tests, setTests] = useState<Test[]>([]);
  const [questions, setQuestions] = useState<Record<string, Question[]>>({});
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // Edit states
  const [editingTest, setEditingTest] = useState<Test | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [newTest, setNewTest] = useState(false);
  const [newQuestion, setNewQuestion] = useState<string | null>(null); // test_id for new question
  const location = useLocation();

  // Determine active tab from URL
  const getActiveTab = (): 'tests' | 'content' | 'pages' => {
    const path = location.pathname;
    if (path.includes('/admin/content')) return 'content';
    if (path.includes('/admin/pages')) return 'pages';
    return 'tests';
  };
  const activeTab = getActiveTab();

  useEffect(() => {
    // Load tests if already authenticated
    if (isAdmin) {
      loadTests();
    }
  }, [isAdmin]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Get admin password from Supabase
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_password')
      .single();

    if (error) {
      setError('Failed to verify password. Please try again.');
      setLoading(false);
      return;
    }

    if (data.value === password) {
      setIsAdmin(true);
      sessionStorage.setItem('admin_auth', 'true');
      loadTests();
    } else {
      setError('Invalid password');
    }
    setLoading(false);
  }

  async function loadTests() {
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTests(data);
    }
  }

  async function loadQuestions(testId: string) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('test_id', testId)
      .order('question_number', { ascending: true });

    if (!error && data) {
      setQuestions(prev => ({ ...prev, [testId]: data }));
    }
  }

  async function toggleTestActive(test: Test) {
    const { error } = await supabase
      .from('tests')
      .update({ is_active: !test.is_active })
      .eq('id', test.id);

    if (!error) {
      loadTests();
    }
  }

  async function saveTest(test: Partial<Test>) {
    const slug = generateSlug(test.title || '');

    if (test.id) {
      // Update existing
      const { error } = await supabase
        .from('tests')
        .update({
          title: test.title,
          slug: slug,
          description: test.description,
          price_cents: test.price_cents,
        })
        .eq('id', test.id);

      if (!error) {
        setEditingTest(null);
        loadTests();
      }
    } else {
      // Create new
      const { error } = await supabase
        .from('tests')
        .insert({
          title: test.title,
          slug: slug,
          description: test.description,
          price_cents: test.price_cents,
          is_active: false,
        });

      if (!error) {
        setNewTest(false);
        loadTests();
      }
    }
  }

  async function deleteTest(testId: string) {
    if (!confirm('Are you sure? This will delete all questions in this test.')) return;

    // Delete questions first
    await supabase.from('questions').delete().eq('test_id', testId);
    // Then delete test
    const { error } = await supabase.from('tests').delete().eq('id', testId);

    if (!error) {
      loadTests();
    }
  }

  async function saveQuestion(question: Partial<Question>, testId: string) {
    if (question.id) {
      // Update existing
      const { error } = await supabase
        .from('questions')
        .update({
          question_number: question.question_number,
          question_text: question.question_text,
          image_url: question.image_url,
          options: question.options,
          correct_answer: question.correct_answer,
          dimension: question.dimension,
        })
        .eq('id', question.id);

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
          question_text: question.question_text,
          image_url: question.image_url,
          options: question.options,
          correct_answer: question.correct_answer,
          dimension: question.dimension,
        });

      if (!error) {
        setNewQuestion(null);
        loadQuestions(testId);
      }
    }
  }

  async function deleteQuestion(questionId: string, testId: string) {
    if (!confirm('Delete this question?')) return;

    const { error } = await supabase.from('questions').delete().eq('id', questionId);

    if (!error) {
      loadQuestions(testId);
    }
  }

  function handleExpandTest(testId: string) {
    if (expandedTest === testId) {
      setExpandedTest(null);
    } else {
      setExpandedTest(testId);
      if (!questions[testId]) {
        loadQuestions(testId);
      }
    }
  }

  // Login form
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
          <div className="text-center mb-8">
            <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Access</h1>
            <p className="text-gray-500 mt-2">Enter password to continue</p>
          </div>

          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent mb-4"
              autoFocus
            />

            {error && (
              <p className="text-red-500 text-sm mb-4">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
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
            <Link to="/" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <Brain className="w-6 h-6 text-indigo-600" />
              <span className="font-bold text-gray-900">{t('admin.panel')}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
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
            to="/admin/content"
            className={`pb-3 px-1 font-medium transition-colors relative ${activeTab === 'content'
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
            to="/admin/pages"
            className={`pb-3 px-1 font-medium transition-colors relative ${activeTab === 'pages'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <span className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              {t('admin.view_pages')}
            </span>
          </Link>
        </div>

        {/* Page Content Tab */}
        {activeTab === 'content' && <PageContentEditor />}

        {/* Tests Tab */}
        {activeTab === 'tests' && (
          <>
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
              {tests.map((test) => (
                <div key={test.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Test Header */}
                  {editingTest?.id === test.id ? (
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
                            onClick={() => setEditingTest(test)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => deleteTest(test.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleExpandTest(test.id)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          >
                            {expandedTest === test.id ? (
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
                  {expandedTest === test.id && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4">
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
                          questionNumber={(questions[test.id]?.length || 0) + 1}
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
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteQuestion(question.id, test.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 rounded"
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

        {/* Pages Tab - Quick access to view and edit pages */}
        {activeTab === 'pages' && (
          <div className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('admin.view_pages')}</h2>
              <p className="text-gray-500 text-sm">{t('admin.view_pages_desc')}</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link
                to="/"
                target="_blank"
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <Brain className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{t('admin.home_page')}</h3>
                </div>
                <p className="text-sm text-gray-500">{t('admin.home_page_desc')}</p>
              </Link>

              <Link
                to="/payment/success?session_id=demo"
                target="_blank"
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-green-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <Eye className="w-5 h-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{t('admin.payment_success')}</h3>
                </div>
                <p className="text-sm text-gray-500">{t('admin.payment_success_desc')}</p>
              </Link>

              <Link
                to="/payment/cancel"
                target="_blank"
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-red-300 hover:shadow-md transition-all group"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center group-hover:bg-red-200 transition-colors">
                    <X className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{t('admin.payment_cancel')}</h3>
                </div>
                <p className="text-sm text-gray-500">{t('admin.payment_cancel_desc')}</p>
              </Link>

              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  alert(t('admin.results_requires_session'));
                }}
                className="bg-white p-6 rounded-xl border border-gray-200 hover:border-purple-300 hover:shadow-md transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <FileText className="w-5 h-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">{t('admin.results_page')}</h3>
                </div>
                <p className="text-sm text-gray-500">{t('admin.results_page_desc')}</p>
              </a>
            </div>
          </div>
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
  onSave: (test: Partial<Test>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [title, setTitle] = useState(test?.title || '');
  const [description, setDescription] = useState(test?.description || '');
  const [price, setPrice] = useState(test ? (test.price_cents / 100).toString() : '5');

  return (
    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
      <div className="space-y-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('admin.test_title')}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('admin.test_description')}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">{t('admin.price')}: $</span>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            min="0"
            step="0.01"
            className="w-24 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          <X className="w-5 h-5" />
        </button>
        <button
          onClick={() => onSave({
            id: test?.id,
            title,
            description,
            price_cents: Math.round(parseFloat(price) * 100),
          })}
          disabled={!title}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {t('admin.save')}
        </button>
      </div>
    </div>
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
  onSave: (question: Partial<Question>) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [qNumber, setQNumber] = useState(question?.question_number || questionNumber);
  const [text, setText] = useState(question?.question_text || '');
  const [imageUrl, setImageUrl] = useState(question?.image_url || '');
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

  return (
    <div className="bg-white p-4 rounded-lg border border-indigo-200 mb-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">{t('admin.question_num')}</label>
          <input
            type="number"
            value={qNumber}
            onChange={(e) => setQNumber(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('admin.dimension')}</label>
          <select
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      <div className="mt-3">
        <label className="text-xs text-gray-500">{t('admin.image_url')}</label>
        <input
          type="text"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
      </div>

      <div className="mt-3">
        <label className="text-xs text-gray-500">{t('admin.options')}</label>
        <div className="space-y-2">
          {options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-sm font-medium w-6">{opt.label}:</span>
              <input
                type="text"
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
        <button onClick={onCancel} className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-sm">
          {t('admin.cancel')}
        </button>
        <button
          onClick={() => onSave({
            id: question?.id,
            question_number: qNumber,
            question_text: text,
            image_url: imageUrl || null,
            options: JSON.stringify(options),
            correct_answer: correctAnswer,
            dimension,
          })}
          disabled={!text}
          className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          <Save className="w-3 h-3" />
          {t('admin.save')}
        </button>
      </div>
    </div>
  );
}
