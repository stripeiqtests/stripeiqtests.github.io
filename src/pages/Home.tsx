import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Test } from '../lib/supabase';
import { Brain, Clock, Target, Sparkles } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../lib/i18n';

export function Home() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useLanguage();

  useEffect(() => {
    loadTests();
  }, []);

  async function loadTests() {
    const { data, error } = await supabase
      .from('tests')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading tests:', error);
    } else {
      setTests(data || []);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-indigo-600" />
            <span className="text-xl font-bold text-gray-900">IQ Test</span>
          </div>
          <div className="flex items-center gap-4">
            <LanguageSwitcher />
            <Link
              to="/admin"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
          {lang === 'ru' ? 'Раскройте свой когнитивный профиль' : 'Discover Your Cognitive Profile'}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-12">
          {lang === 'ru'
            ? 'Пройдите наш комплексный IQ тест и получите детальный анализ ваших когнитивных способностей по четырём ключевым измерениям'
            : 'Take our comprehensive IQ test and unlock detailed insights into your cognitive strengths across four key dimensions'
          }
        </p>

        {/* Features */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <Clock className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">
              {lang === 'ru' ? '10-15 минут' : '10-15 Minutes'}
            </h3>
            <p className="text-sm text-gray-500">
              {lang === 'ru' ? 'Быстрая и эффективная оценка' : 'Quick and efficient assessment'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <Target className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">
              {lang === 'ru' ? '20-25 вопросов' : '20-25 Questions'}
            </h3>
            <p className="text-sm text-gray-500">
              {lang === 'ru' ? 'Комплексная оценка' : 'Comprehensive evaluation'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <Brain className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">
              {lang === 'ru' ? '4 измерения' : '4 Dimensions'}
            </h3>
            <p className="text-sm text-gray-500">
              {lang === 'ru' ? 'Аналитик, Стратег, Наблюдатель, Интуит' : 'Analyst, Strategist, Observer, Intuitive'}
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <Sparkles className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">
              {lang === 'ru' ? 'Визуальные задачи' : 'Visual Puzzles'}
            </h3>
            <p className="text-sm text-gray-500">
              {lang === 'ru' ? 'Логика + визуальное мышление' : 'Logic + visual reasoning tasks'}
            </p>
          </div>
        </div>
      </section>

      {/* Available Tests */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
          {t('home.available_tests')}
        </h2>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">{t('common.loading')}</p>
          </div>
        ) : tests.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
            <Brain className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('home.no_tests')}</p>
            <p className="text-sm text-gray-400 mt-2">{t('home.check_later')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <div
                key={test.id}
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{test.title}</h3>
                    <p className="text-gray-600 mb-4">{test.description}</p>
                    <p className="text-sm text-gray-500">
                      {lang === 'ru' ? 'Цена: ' : 'Price: '}
                      <span className="font-semibold text-indigo-600">${(test.price_cents / 100).toFixed(2)}</span>
                      {lang === 'ru' ? ' за результаты' : ' for results'}
                    </p>
                  </div>
                  <Link
                    to={`/${test.slug}`}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors whitespace-nowrap"
                  >
                    {t('home.start_test')}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>
            {lang === 'ru'
              ? 'Этот тест предназначен только для развлечения и не является профессиональной психологической оценкой.'
              : 'This test is for entertainment purposes only and does not constitute a professional psychological assessment.'
            }
          </p>
        </div>
      </footer>
    </div>
  );
}
