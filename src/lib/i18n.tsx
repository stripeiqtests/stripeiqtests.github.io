/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

type Language = 'ru' | 'en';
type LanguageMode = 'ru' | 'en' | 'bilingual';

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: (key: string) => string;
    languageMode: LanguageMode;
    setLanguageMode: (mode: LanguageMode) => Promise<void>;
    languageModeLoading: boolean;
}

const translations = {
    ru: {
        // Home page
        'home.title': 'IQ Тесты',
        'home.subtitle': 'Проверьте свои когнитивные способности',
        'home.available_tests': 'Доступные тесты',
        'home.no_tests': 'Тестов пока нет',
        'home.check_later': 'Загляните позже.',
        'home.questions': 'вопросов',
        'home.start_test': 'Начать тест',

        // Test page
        'test.question': 'Вопрос',
        'test.of': 'из',
        'test.next': 'Далее',
        'test.finish': 'Завершить',
        'test.loading': 'Загрузка...',
        'test.not_found': 'Тест не найден',
        'test.no_questions': 'Вопросы не найдены',
        'test.enter_email': 'Введите ваш email для получения результатов',
        'test.email_placeholder': 'your@email.com',
        'test.submit_results': 'Отправить результаты',

        // Results page
        'results.title': 'Результаты IQ теста',
        'results.overall_score': 'ОБЩИЙ БАЛЛ',
        'results.analyst': 'Аналитик',
        'results.analyst_desc': 'Логическое мышление, анализ данных',
        'results.strategist': 'Стратег',
        'results.strategist_desc': 'Планирование, оптимизация',
        'results.observer': 'Наблюдатель',
        'results.observer_desc': 'Визуальное восприятие, пространственное мышление',
        'results.intuitive': 'Интуит',
        'results.intuitive_desc': 'Креативность, ассоциативное мышление',
        'results.profile': 'Ваш когнитивный профиль',
        'results.email_sent': 'Копия результатов отправлена на',
        'results.take_another': 'Пройти другой тест',
        'results.unlock': 'Разблокировать результаты',
        'results.includes': 'В результаты входят:',
        'results.includes_score': 'Общий IQ балл',
        'results.includes_dimensions': '4 измерения анализа',
        'results.includes_analysis': 'Персональный анализ',
        'results.includes_career': 'Рекомендации по карьере',
        'results.includes_email': 'Копия на email',

        // Payment
        'payment.unlock_results': 'Разблокировать результаты',
        'payment.processing': 'Обработка...',
        'payment.success': 'Оплата прошла успешно!',
        'payment.verifying': 'Проверяем оплату...',
        'payment.failed': 'Ошибка оплаты',

        // Common
        'common.loading': 'Загрузка...',
        'common.error': 'Ошибка',
        'common.back': 'Назад',
        'common.cancel': 'Отмена',
        'common.submit': 'Отправить',
        'common.get_results': 'Получить результаты',
        'common.email_optional': 'Email (опционально)',
        'common.email_hint': 'Мы отправим результаты на этот email после оплаты',
        'common.submit_error': 'Ошибка отправки. Попробуйте еще раз.',

        // Score interpretations
        'score.excellent': 'Отлично! Ваши способности высокоразвиты.',
        'score.good': 'Хороший результат! Ваши способности выше среднего.',
        'score.average': 'Средний результат. Есть потенциал для развития.',
        'score.improve': 'Есть возможности для улучшения.',

        // Profile descriptions
        'profile.analyst': 'Вы превосходно справляетесь с логическими задачами и анализом данных. Карьера в аналитике, программировании и науке вам подходит.',
        'profile.strategist': 'Вы умеете планировать наперёд и видеть общую картину. Лидерство и управление проектами — ваши сильные стороны.',
        'profile.observer': 'У вас отличное пространственное мышление и внимание к деталям. Дизайн, архитектура и инженерия вам подходят.',
        'profile.intuitive': 'Ваше творческое мышление позволяет находить нестандартные решения. Творческие профессии и инновации — ваше призвание.',

        // Admin Panel
        'admin.panel': 'Панель администратора',
        'admin.login': 'Вход в админ-панель',
        'admin.password': 'Пароль',
        'admin.enter': 'Войти',
        'admin.logout': 'Выйти',
        'admin.back_home': '← На главную',
        'admin.manage_tests': 'Управление тестами',
        'admin.archetypes': 'Архетипы',
        'admin.page_content': 'Контент страниц',
        'admin.new_test': 'Новый тест',
        'admin.edit': 'Редактировать',
        'admin.delete': 'Удалить',
        'admin.save': 'Сохранить',
        'admin.cancel': 'Отмена',
        'admin.save_changes': 'Сохранить изменения',
        'admin.saving': 'Сохранение...',
        'admin.no_tests': 'Тесты ещё не созданы.',
        'admin.create_first': 'Создать первый тест',
        'admin.questions': 'вопросов',
        'admin.add_question': 'Добавить вопрос',
        'admin.home_page': 'Главная страница',
        'admin.payment_success': 'Успешная оплата',
        'admin.payment_cancel': 'Отмена оплаты',
        'admin.results_page': 'Страница результатов',
        'admin.view_pages': 'Просмотр страниц',
        'admin.view_pages_desc': 'Откройте страницы для редактирования контента на месте',
        'admin.home_page_desc': 'Редактировать заголовки и описания',
        'admin.payment_success_desc': 'Сообщения об успешной оплате',
        'admin.payment_cancel_desc': 'Сообщения об отмене оплаты',
        'admin.results_page_desc': 'Требуется реальная сессия теста',
        'admin.paywall': 'Экран оплаты',
        'admin.paywall_desc': 'Текст на странице до оплаты',
        'admin.results_requires_session': 'Страница результатов требует реальной сессии теста. Пройдите тест чтобы увидеть эту страницу.',
        // Test form
        'admin.test_title': 'Название теста',
        'admin.test_description': 'Описание',
        'admin.price': 'Цена',
        'admin.active': 'Активный',
        'admin.inactive': 'Неактивный',
        'admin.activate': 'Активировать',
        'admin.deactivate': 'Деактивировать',
        // Question form
        'admin.question_num': 'Вопрос №',
        'admin.dimension': 'Измерение',
        'admin.analyst': 'Аналитик',
        'admin.strategist': 'Стратег',
        'admin.observer': 'Наблюдатель',
        'admin.intuitive': 'Интуит',
        'admin.question_text': 'Текст вопроса',
        'admin.image_url': 'URL изображения (опционально)',
        'admin.options': 'Варианты ответов',
        'admin.correct_answer': 'Правильный ответ',
    },
    en: {
        // Home page
        'home.title': 'IQ Tests',
        'home.subtitle': 'Test your cognitive abilities',
        'home.available_tests': 'Available Tests',
        'home.no_tests': 'No tests available',
        'home.check_later': 'Check back later.',
        'home.questions': 'questions',
        'home.start_test': 'Start Test',

        // Test page
        'test.question': 'Question',
        'test.of': 'of',
        'test.next': 'Next',
        'test.finish': 'Finish',
        'test.loading': 'Loading...',
        'test.not_found': 'Test not found',
        'test.no_questions': 'No questions found',
        'test.enter_email': 'Enter your email to receive results',
        'test.email_placeholder': 'your@email.com',
        'test.submit_results': 'Submit Results',

        // Results page
        'results.title': 'Your IQ Test Results',
        'results.overall_score': 'OVERALL SCORE',
        'results.analyst': 'Analyst',
        'results.analyst_desc': 'Logical thinking, data analysis',
        'results.strategist': 'Strategist',
        'results.strategist_desc': 'Planning, optimization',
        'results.observer': 'Observer',
        'results.observer_desc': 'Visual perception, spatial thinking',
        'results.intuitive': 'Intuitive',
        'results.intuitive_desc': 'Creativity, associative thinking',
        'results.profile': 'Your Cognitive Profile',
        'results.email_sent': 'A copy of these results has been sent to',
        'results.take_another': 'Take Another Test',
        'results.unlock': 'Unlock Your Results',
        'results.includes': 'Your Results Include:',
        'results.includes_score': 'Overall IQ Score',
        'results.includes_dimensions': '4 Dimension Breakdown',
        'results.includes_analysis': 'Personalized Analysis',
        'results.includes_career': 'Career Recommendations',
        'results.includes_email': 'Email Copy of Results',

        // Payment
        'payment.unlock_results': 'Unlock Results',
        'payment.processing': 'Processing...',
        'payment.success': 'Payment Successful!',
        'payment.verifying': 'Verifying payment...',
        'payment.failed': 'Payment failed',

        // Common
        'common.loading': 'Loading...',
        'common.error': 'Error',
        'common.back': 'Back',
        'common.cancel': 'Cancel',
        'common.submit': 'Submit',
        'common.get_results': 'Get Results',
        'common.email_optional': 'Email (optional)',
        'common.email_hint': "We'll send your results to this email after payment",
        'common.submit_error': 'Failed to submit. Please try again.',

        // Score interpretations
        'score.excellent': 'Excellent! Your abilities are highly developed.',
        'score.good': 'Good result! Your abilities are above average.',
        'score.average': 'Average result. There is potential for development.',
        'score.improve': 'There are opportunities for improvement.',

        // Profile descriptions
        'profile.analyst': 'You excel at logical tasks and data analysis. Careers in analytics, programming, and science suit you well.',
        'profile.strategist': 'You are skilled at planning ahead and seeing the big picture. Leadership and project management are your strengths.',
        'profile.observer': 'You have excellent spatial thinking and attention to detail. Design, architecture, and engineering suit you.',
        'profile.intuitive': 'Your creative thinking allows you to find unconventional solutions. Creative professions and innovation are your calling.',

        // Admin Panel
        'admin.panel': 'Admin Panel',
        'admin.login': 'Admin Login',
        'admin.password': 'Password',
        'admin.enter': 'Enter',
        'admin.logout': 'Logout',
        'admin.back_home': '← Back to Home',
        'admin.manage_tests': 'Manage Tests',
        'admin.archetypes': 'Archetypes',
        'admin.page_content': 'Page Content',
        'admin.new_test': 'New Test',
        'admin.edit': 'Edit',
        'admin.delete': 'Delete',
        'admin.save': 'Save',
        'admin.cancel': 'Cancel',
        'admin.save_changes': 'Save Changes',
        'admin.saving': 'Saving...',
        'admin.no_tests': 'No tests created yet.',
        'admin.create_first': 'Create your first test',
        'admin.questions': 'questions',
        'admin.add_question': 'Add Question',
        'admin.home_page': 'Home Page',
        'admin.payment_success': 'Payment Success',
        'admin.payment_cancel': 'Payment Cancel',
        'admin.results_page': 'Results Page',
        'admin.view_pages': 'View Pages',
        'admin.view_pages_desc': 'Open pages to edit content inline',
        'admin.home_page_desc': 'Edit headings and descriptions',
        'admin.payment_success_desc': 'Success messages after payment',
        'admin.payment_cancel_desc': 'Cancellation messages',
        'admin.results_page_desc': 'Requires an actual test session',
        'admin.paywall': 'Paywall',
        'admin.paywall_desc': 'Pre-payment page text',
        'admin.results_requires_session': 'Results page requires an actual test session. Complete a test to view this page.',
        // Test form
        'admin.test_title': 'Test Title',
        'admin.test_description': 'Description',
        'admin.price': 'Price',
        'admin.active': 'Active',
        'admin.inactive': 'Inactive',
        'admin.activate': 'Activate',
        'admin.deactivate': 'Deactivate',
        // Question form
        'admin.question_num': 'Question #',
        'admin.dimension': 'Dimension',
        'admin.analyst': 'Analyst',
        'admin.strategist': 'Strategist',
        'admin.observer': 'Observer',
        'admin.intuitive': 'Intuitive',
        'admin.question_text': 'Question Text',
        'admin.image_url': 'Image URL (optional)',
        'admin.options': 'Options',
        'admin.correct_answer': 'Correct Answer',
    },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [languageMode, setLanguageModeState] = useState<LanguageMode>('ru');
    const [languageModeLoading, setLanguageModeLoading] = useState(true);
    const [lang, setLangState] = useState<Language>('ru');

    // Load language mode from database on mount
    useEffect(() => {
        async function loadLanguageMode() {
            try {
                const { data } = await supabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'language_mode')
                    .single();

                const mode = (data?.value as LanguageMode) || 'ru';
                setLanguageModeState(mode);

                // Set language based on mode
                if (mode === 'bilingual') {
                    // In bilingual mode, respect user's saved preference
                    const saved = localStorage.getItem('lang');
                    setLangState((saved === 'en' || saved === 'ru') ? saved : 'ru');
                } else {
                    // In single-language mode, force that language
                    setLangState(mode);
                    localStorage.setItem('lang', mode);
                }
            } catch (error) {
                console.error('Error loading language mode:', error);
                // Default to Russian
                setLangState('ru');
            } finally {
                setLanguageModeLoading(false);
            }
        }

        loadLanguageMode();
    }, []);

    const setLang = (newLang: Language) => {
        // Only allow switching in bilingual mode
        if (languageMode === 'bilingual') {
            setLangState(newLang);
            localStorage.setItem('lang', newLang);
        }
    };

    const setLanguageMode = async (mode: LanguageMode) => {
        try {
            // Update in database
            const { error: updateError } = await supabase
                .from('app_settings')
                .update({ value: mode })
                .eq('key', 'language_mode');

            if (updateError) {
                // Try insert if update fails
                await supabase
                    .from('app_settings')
                    .insert({ key: 'language_mode', value: mode });
            }

            setLanguageModeState(mode);

            // Update current language based on new mode
            if (mode !== 'bilingual') {
                setLangState(mode);
                localStorage.setItem('lang', mode);
            }
        } catch (error) {
            console.error('Error saving language mode:', error);
            throw error;
        }
    };

    const t = (key: string): string => {
        return translations[lang][key as keyof typeof translations['ru']] || key;
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, languageMode, setLanguageMode, languageModeLoading }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within LanguageProvider');
    }
    return context;
}

// Language switcher component - only visible in bilingual mode
export function LanguageSwitcher() {
    const { lang, setLang, languageMode, languageModeLoading } = useLanguage();

    // Hide switcher if not in bilingual mode or still loading
    if (languageModeLoading || languageMode !== 'bilingual') {
        return null;
    }

    return (
        <div className="language-switcher">
            <button
                className={`lang-btn ${lang === 'ru' ? 'active' : ''}`}
                onClick={() => setLang('ru')}
            >
                RU
            </button>
            <button
                className={`lang-btn ${lang === 'en' ? 'active' : ''}`}
                onClick={() => setLang('en')}
            >
                EN
            </button>
        </div>
    );
}
