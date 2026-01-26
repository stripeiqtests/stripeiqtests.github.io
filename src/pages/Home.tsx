import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Test, HomeContent } from '../lib/supabase';
import { Brain, Clock, Target, Sparkles, Settings, Edit2, BookOpen, ChevronDown } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../lib/i18n';
import { useAdmin } from '../lib/AdminContext';
import { EditableField } from '../components/EditableField';

export function Home() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<Record<string, string>>({});
  const { t, lang } = useLanguage();
  const { isAdmin } = useAdmin();

  useEffect(() => {
    loadTests();
    loadContent();
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

  async function loadContent() {
    const { data, error } = await supabase
      .from('home_content')
      .select('*');

    if (error) {
      console.error('Error loading content:', error);
      return;
    }

    const contentMap: Record<string, string> = {};
    (data as HomeContent[] || []).forEach(item => {
      contentMap[item.key] = item.value;
    });
    setContent(contentMap);
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

  // Get content with fallback to default
  const getContent = (key: string, fallback: string) => content[key] || fallback;

  const heroTitle = lang === 'ru'
    ? getContent('hero_title_ru', 'Раскройте свой когнитивный профиль')
    : getContent('hero_title_en', 'Discover Your Cognitive Profile');

  const heroSubtitle = lang === 'ru'
    ? getContent('hero_subtitle_ru', 'Пройдите наш комплексный IQ тест и получите детальный анализ ваших когнитивных способностей по четырём ключевым измерениям')
    : getContent('hero_subtitle_en', 'Take our comprehensive IQ test and unlock detailed insights into your cognitive strengths across four key dimensions');

  const footerText = lang === 'ru'
    ? getContent('footer_ru', 'Этот тест предназначен только для развлечения и не является профессиональной психологической оценкой.')
    : getContent('footer_en', 'This test is for entertainment purposes only and does not constitute a professional psychological assessment.');

  // Feature card content
  const feature1Title = lang === 'ru' ? getContent('feature1_title_ru', '10-15 минут') : getContent('feature1_title_en', '10-15 Minutes');
  const feature1Desc = lang === 'ru' ? getContent('feature1_desc_ru', 'Быстрая и эффективная оценка') : getContent('feature1_desc_en', 'Quick and efficient assessment');
  const feature2Title = lang === 'ru' ? getContent('feature2_title_ru', '20-25 вопросов') : getContent('feature2_title_en', '20-25 Questions');
  const feature2Desc = lang === 'ru' ? getContent('feature2_desc_ru', 'Комплексная оценка') : getContent('feature2_desc_en', 'Comprehensive evaluation');
  const feature3Title = lang === 'ru' ? getContent('feature3_title_ru', '4 измерения') : getContent('feature3_title_en', '4 Dimensions');
  const feature3Desc = lang === 'ru' ? getContent('feature3_desc_ru', 'Аналитик, Стратег, Наблюдатель, Интуит') : getContent('feature3_desc_en', 'Analyst, Strategist, Observer, Intuitive');
  const feature4Title = lang === 'ru' ? getContent('feature4_title_ru', 'Визуальные задачи') : getContent('feature4_title_en', 'Visual Puzzles');
  const feature4Desc = lang === 'ru' ? getContent('feature4_desc_ru', 'Логика + визуальное мышление') : getContent('feature4_desc_en', 'Logic + visual reasoning tasks');

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
            {isAdmin && (
              <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
                Admin Mode
              </span>
            )}
            <Link
              to="/admin"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
            >
              <Settings className="w-4 h-4" />
              Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-16 text-center">
        <EditableField
          value={heroTitle}
          onSave={(value) => saveContent(lang === 'ru' ? 'hero_title_ru' : 'hero_title_en', value)}
          as="h1"
          className="text-4xl md:text-5xl font-bold text-gray-900 mb-6"
        />
        <div className="max-w-2xl mx-auto mb-12">
          <EditableField
            value={heroSubtitle}
            onSave={(value) => saveContent(lang === 'ru' ? 'hero_subtitle_ru' : 'hero_subtitle_en', value)}
            as="p"
            className="text-xl text-gray-600"
            multiline
          />
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-4 gap-6 mb-16">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <Clock className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <EditableField
              value={feature1Title}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature1_title_ru' : 'feature1_title_en', value)}
              as="h3"
              className="font-semibold text-gray-900 mb-2"
            />
            <EditableField
              value={feature1Desc}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature1_desc_ru' : 'feature1_desc_en', value)}
              as="p"
              className="text-sm text-gray-500"
            />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <Target className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <EditableField
              value={feature2Title}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature2_title_ru' : 'feature2_title_en', value)}
              as="h3"
              className="font-semibold text-gray-900 mb-2"
            />
            <EditableField
              value={feature2Desc}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature2_desc_ru' : 'feature2_desc_en', value)}
              as="p"
              className="text-sm text-gray-500"
            />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <Brain className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <EditableField
              value={feature3Title}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature3_title_ru' : 'feature3_title_en', value)}
              as="h3"
              className="font-semibold text-gray-900 mb-2"
            />
            <EditableField
              value={feature3Desc}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature3_desc_ru' : 'feature3_desc_en', value)}
              as="p"
              className="text-sm text-gray-500"
            />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 text-center">
            <Sparkles className="w-10 h-10 text-indigo-500 mx-auto mb-4" />
            <EditableField
              value={feature4Title}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature4_title_ru' : 'feature4_title_en', value)}
              as="h3"
              className="font-semibold text-gray-900 mb-2"
            />
            <EditableField
              value={feature4Desc}
              onSave={(value) => saveContent(lang === 'ru' ? 'feature4_desc_ru' : 'feature4_desc_en', value)}
              as="p"
              className="text-sm text-gray-500"
            />
          </div>
        </div>
      </section>

      {/* Methodology (collapsible) */}
      <section className="max-w-4xl mx-auto px-4 pb-8">
        <details className="group bg-white rounded-2xl shadow-sm border border-gray-100" open>
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer select-none">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              <span className="font-semibold text-gray-900">На чём основан этот тест</span>
            </div>
            <div className="text-gray-400 group-open:rotate-180 transition-transform">
              <ChevronDown className="w-5 h-5" />
            </div>
          </summary>
          <div className="px-6 pb-6 pt-2 space-y-3 text-sm leading-relaxed text-gray-700">
            <p>
              Этот тест не является медицинской или клинической диагностикой. Он создан как интерпретационный инструмент,
              помогающий понять, какой способ мышления у вас является ведущим и через какие архетипические образы он чаще всего проявляется.
            </p>

            {/* Sub-section 1 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">🧠 Что именно мы измеряем</h4>
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-2">
                <p>В основе теста лежит когнитивный стиль мышления — то, как человек обрабатывает информацию, принимает решения и ориентируется в реальности.</p>
                <p className="text-gray-600">В психологии выделяют когнитивные стили:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>аналитический</li>
                  <li>стратегический</li>
                  <li>наблюдательный</li>
                  <li>интуитивный</li>
                </ul>
                <p>Это не черты характера и не «типы личности», а способы мышления, которые могут меняться и сочетаться.</p>
              </div>
            </details>

            {/* Sub-section 2 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">🧩 Как здесь появляются архетипы</h4>
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-2">
                <p>Карл Юнг не связывал напрямую тип мышления с конкретным архетипом. В юнгианской психологии:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>архетипы — модели поведения, энергии и ролей;</li>
                  <li>а не описание интеллекта или логики.</li>
                </ul>
                <p>Связь «тип мышления → архетип» — интерпретационная модель.</p>
              </div>
            </details>

            {/* Sub-section 3 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">🧱 На что мы опираемся</h4>
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-gray-900">1. Аналитическая психология К. Г. Юнга</p>
                  <p className="text-gray-700">Базовые функции: мышление, чувство, интуиция, ощущение. Архетипы — формы проявления этих функций.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-gray-900">2. Современная психология мышления</p>
                  <p className="text-gray-700">Когнитивные стили коррелируют с моделями поведения. Аналитическое мышление чаще связано с контролем, иерархией, ответственностью, структурой — поэтому сочетается с архетипами Короля/Королевы или Мага.</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                  <p className="font-medium text-gray-900">3. Культурная и архетипическая психология</p>
                  <p className="text-gray-700">(Joseph Campbell, Carol S. Pearson). Устойчивые образы: Король/Королева — порядок, Воин — действие, Маг — знание, Трикстер — интуиция и игра.</p>
                </div>
              </div>
            </details>

            {/* Sub-section 4 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">🔍 Как проверить самостоятельно</h4>
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-2">
                <p className="text-gray-700">Ищите по запросам:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li><em className="text-indigo-600 not-italic bg-indigo-50 px-1.5 py-0.5 rounded">cognitive styles psychology</em></li>
                  <li><em className="text-indigo-600 not-italic bg-indigo-50 px-1.5 py-0.5 rounded">Jung psychological functions</em></li>
                  <li><em className="text-indigo-600 not-italic bg-indigo-50 px-1.5 py-0.5 rounded">archetypes king magician warrior trickster</em></li>
                  <li><em className="text-indigo-600 not-italic bg-indigo-50 px-1.5 py-0.5 rounded">Carol Pearson archetypes</em></li>
                  <li><em className="text-indigo-600 not-italic bg-indigo-50 px-1.5 py-0.5 rounded">Joseph Campbell archetypal psychology</em></li>
                </ul>
              </div>
            </details>

            {/* Sub-section 5 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <h4 className="font-semibold text-gray-900 flex items-center gap-2">🧭 Как воспринимать результаты</h4>
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4 space-y-2">
                <p>Результаты показывают ваш ведущий способ мышления и архетипическое направление, через которое он проявляется.</p>
                <p className="text-gray-700">Обычно у человека:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1">
                  <li>1 основной архетип</li>
                  <li>1–2 поддерживающих</li>
                  <li>1 архетип в тени</li>
                </ul>
                <p>За более точной картиной — углублённый тест.</p>
              </div>
            </details>
          </div>
        </details>
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
                className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative"
              >
                {/* Admin Edit Button */}
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="absolute top-3 right-3 p-2 rounded-full bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors border border-amber-200"
                    title={lang === 'ru' ? 'Редактировать тест' : 'Edit test'}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Link>
                )}
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
          <EditableField
            value={footerText}
            onSave={(value) => saveContent(lang === 'ru' ? 'footer_ru' : 'footer_en', value)}
            as="p"
            className="text-sm text-gray-500"
            multiline
          />
        </div>
      </footer>
    </div>
  );
}
