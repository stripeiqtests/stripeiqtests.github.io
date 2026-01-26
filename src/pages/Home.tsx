import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Test } from '../lib/supabase';
import { Brain, Clock, Target, Sparkles, Settings, Edit2, BookOpen, ChevronDown } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../lib/i18n';
import { useAdmin } from '../lib/AdminContext';
import { EditableField } from '../components/EditableField';
import { useContent } from '../lib/useContent';

export function Home() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const { t, lang } = useLanguage();
  const { isAdmin } = useAdmin();
  const { getContent, saveContent } = useContent();

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

  // Methodology section content
  const methodologyTitle = lang === 'ru' ? getContent('methodology_title_ru', 'На чём основан этот тест') : getContent('methodology_title_en', 'What This Test Is Based On');
  const methodologyIntro = lang === 'ru'
    ? getContent('methodology_intro_ru', 'Этот тест не является медицинской или клинической диагностикой. Он создан как интерпретационный инструмент, помогающий понять, какой способ мышления у вас является ведущим и через какие архетипические образы он чаще всего проявляется.')
    : getContent('methodology_intro_en', 'This test is not a medical or clinical diagnosis. It is an interpretive tool designed to help you understand your dominant thinking style and the archetypal patterns through which it manifests.');

  const methodSub1Title = lang === 'ru' ? getContent('method_sub1_title_ru', '🧠 Что именно мы измеряем') : getContent('method_sub1_title_en', '🧠 What We Measure');
  const methodSub1Content = lang === 'ru'
    ? getContent('method_sub1_content_ru', 'В основе теста лежит когнитивный стиль мышления — то, как человек обрабатывает информацию, принимает решения и ориентируется в реальности. В психологии выделяют когнитивные стили: аналитический, стратегический, наблюдательный, интуитивный. Это не черты характера и не «типы личности», а способы мышления, которые могут меняться и сочетаться.')
    : getContent('method_sub1_content_en', 'The test is based on cognitive thinking styles — how a person processes information, makes decisions, and navigates reality. Psychology identifies cognitive styles: analytical, strategic, observational, intuitive. These are not personality traits but thinking patterns that can change and combine.');

  const methodSub2Title = lang === 'ru' ? getContent('method_sub2_title_ru', '🧩 Как здесь появляются архетипы') : getContent('method_sub2_title_en', '🧩 How Archetypes Appear');
  const methodSub2Content = lang === 'ru'
    ? getContent('method_sub2_content_ru', 'Карл Юнг не связывал напрямую тип мышления с конкретным архетипом. В юнгианской психологии: архетипы — модели поведения, энергии и ролей; а не описание интеллекта или логики. Связь «тип мышления → архетип» — интерпретационная модель.')
    : getContent('method_sub2_content_en', 'Carl Jung did not directly link thinking types with specific archetypes. In Jungian psychology: archetypes are patterns of behavior, energy, and roles; not descriptions of intellect or logic. The "thinking type → archetype" connection is an interpretive model.');

  const methodSub3Title = lang === 'ru' ? getContent('method_sub3_title_ru', '🧱 На что мы опираемся') : getContent('method_sub3_title_en', '🧱 Our Foundation');
  const methodSub3Content = lang === 'ru'
    ? getContent('method_sub3_content_ru', '1. Аналитическая психология К. Г. Юнга — базовые функции: мышление, чувство, интуиция, ощущение. 2. Современная психология мышления — когнитивные стили коррелируют с моделями поведения. 3. Культурная психология (Joseph Campbell, Carol S. Pearson) — устойчивые архетипические образы.')
    : getContent('method_sub3_content_en', '1. Analytical Psychology of C.G. Jung — basic functions: thinking, feeling, intuition, sensation. 2. Modern psychology of thinking — cognitive styles correlate with behavior patterns. 3. Cultural psychology (Joseph Campbell, Carol S. Pearson) — stable archetypal images.');

  const methodSub4Title = lang === 'ru' ? getContent('method_sub4_title_ru', '🔍 Как проверить самостоятельно') : getContent('method_sub4_title_en', '🔍 How to Verify Yourself');
  const methodSub4Content = lang === 'ru'
    ? getContent('method_sub4_content_ru', 'Ищите по запросам: cognitive styles psychology, Jung psychological functions, archetypes king magician warrior trickster, Carol Pearson archetypes, Joseph Campbell archetypal psychology.')
    : getContent('method_sub4_content_en', 'Search for: cognitive styles psychology, Jung psychological functions, archetypes king magician warrior trickster, Carol Pearson archetypes, Joseph Campbell archetypal psychology.');

  const methodSub5Title = lang === 'ru' ? getContent('method_sub5_title_ru', '🧭 Как воспринимать результаты') : getContent('method_sub5_title_en', '🧭 How to Interpret Results');
  const methodSub5Content = lang === 'ru'
    ? getContent('method_sub5_content_ru', 'Результаты показывают ваш ведущий способ мышления и архетипическое направление. Обычно у человека: 1 основной архетип, 1–2 поддерживающих, 1 архетип в тени. За более точной картиной — углублённый тест.')
    : getContent('method_sub5_content_en', 'Results show your dominant thinking style and archetypal direction. Typically a person has: 1 main archetype, 1-2 supporting, 1 shadow archetype. For a more accurate picture — take the extended test.');

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
              <EditableField
                value={methodologyTitle}
                onSave={(value) => saveContent(lang === 'ru' ? 'methodology_title_ru' : 'methodology_title_en', value)}
                as="span"
                className="font-semibold text-gray-900"
              />
            </div>
            <div className="text-gray-400 group-open:rotate-180 transition-transform">
              <ChevronDown className="w-5 h-5" />
            </div>
          </summary>
          <div className="px-6 pb-6 pt-2 space-y-3 text-sm leading-relaxed text-gray-700">
            <EditableField
              value={methodologyIntro}
              onSave={(value) => saveContent(lang === 'ru' ? 'methodology_intro_ru' : 'methodology_intro_en', value)}
              as="p"
              multiline
            />

            {/* Sub-section 1 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <EditableField
                  value={methodSub1Title}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub1_title_ru' : 'method_sub1_title_en', value)}
                  as="h4"
                  className="font-semibold text-gray-900 flex items-center gap-2"
                />
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <EditableField
                  value={methodSub1Content}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub1_content_ru' : 'method_sub1_content_en', value)}
                  as="p"
                  multiline
                />
              </div>
            </details>

            {/* Sub-section 2 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <EditableField
                  value={methodSub2Title}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub2_title_ru' : 'method_sub2_title_en', value)}
                  as="h4"
                  className="font-semibold text-gray-900 flex items-center gap-2"
                />
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <EditableField
                  value={methodSub2Content}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub2_content_ru' : 'method_sub2_content_en', value)}
                  as="p"
                  multiline
                />
              </div>
            </details>

            {/* Sub-section 3 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <EditableField
                  value={methodSub3Title}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub3_title_ru' : 'method_sub3_title_en', value)}
                  as="h4"
                  className="font-semibold text-gray-900 flex items-center gap-2"
                />
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <EditableField
                  value={methodSub3Content}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub3_content_ru' : 'method_sub3_content_en', value)}
                  as="p"
                  multiline
                />
              </div>
            </details>

            {/* Sub-section 4 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <EditableField
                  value={methodSub4Title}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub4_title_ru' : 'method_sub4_title_en', value)}
                  as="h4"
                  className="font-semibold text-gray-900 flex items-center gap-2"
                />
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <EditableField
                  value={methodSub4Content}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub4_content_ru' : 'method_sub4_content_en', value)}
                  as="p"
                  multiline
                />
              </div>
            </details>

            {/* Sub-section 5 */}
            <details className="group/sub border border-gray-100 rounded-lg">
              <summary className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-gray-50 rounded-lg">
                <EditableField
                  value={methodSub5Title}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub5_title_ru' : 'method_sub5_title_en', value)}
                  as="h4"
                  className="font-semibold text-gray-900 flex items-center gap-2"
                />
                <ChevronDown className="w-4 h-4 text-gray-400 group-open/sub:rotate-180 transition-transform" />
              </summary>
              <div className="px-4 pb-4">
                <EditableField
                  value={methodSub5Content}
                  onSave={(value) => saveContent(lang === 'ru' ? 'method_sub5_content_ru' : 'method_sub5_content_en', value)}
                  as="p"
                  multiline
                />
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
        <div className="max-w-6xl mx-auto px-4 text-center">
          <EditableField
            value={footerText}
            onSave={(value) => saveContent(lang === 'ru' ? 'footer_ru' : 'footer_en', value)}
            as="p"
            className="text-sm text-gray-500"
            multiline
          />
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <a href="/privacy" className="text-gray-400 hover:text-indigo-600 transition-colors">
              {lang === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}
            </a>
            <span className="text-gray-300">|</span>
            <a href="/terms" className="text-gray-400 hover:text-indigo-600 transition-colors">
              {lang === 'ru' ? 'Условия использования' : 'Terms of Use'}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
