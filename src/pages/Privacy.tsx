import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function Privacy() {
    const { lang } = useLanguage();

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
            <div className="max-w-3xl mx-auto px-4 py-12">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 mb-8"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {lang === 'ru' ? 'На главную' : 'Back to Home'}
                </Link>

                <div className="bg-white rounded-2xl shadow-lg p-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">
                        {lang === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}
                    </h1>

                    <div className="prose prose-gray max-w-none">
                        {lang === 'ru' ? (
                            <>
                                <p className="text-gray-600 mb-4">
                                    Настоящая политика конфиденциальности описывает, как мы собираем, используем и защищаем вашу персональную информацию.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">1. Сбор информации</h2>
                                <p className="text-gray-600 mb-4">
                                    Мы собираем следующую информацию:
                                </p>
                                <ul className="list-disc pl-6 text-gray-600 mb-4">
                                    <li>Email-адрес (при желании получить результаты на почту)</li>
                                    <li>Ответы на вопросы теста</li>
                                    <li>Результаты прохождения теста</li>
                                    <li>Информация об оплате (обрабатывается Stripe)</li>
                                </ul>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2. Использование данных</h2>
                                <p className="text-gray-600 mb-4">
                                    Собранные данные используются для:
                                </p>
                                <ul className="list-disc pl-6 text-gray-600 mb-4">
                                    <li>Расчёта и отображения результатов теста</li>
                                    <li>Отправки результатов на указанный email</li>
                                    <li>Обработки платежей</li>
                                    <li>Улучшения качества сервиса</li>
                                </ul>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3. Сторонние сервисы</h2>
                                <p className="text-gray-600 mb-4">
                                    Мы используем следующие сторонние сервисы:
                                </p>
                                <ul className="list-disc pl-6 text-gray-600 mb-4">
                                    <li><strong>Stripe</strong> — для обработки платежей</li>
                                    <li><strong>Supabase</strong> — для хранения данных</li>
                                    <li><strong>Google Analytics</strong> — для аналитики посещаемости</li>
                                    <li><strong>Resend</strong> — для отправки email</li>
                                </ul>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4. Cookies</h2>
                                <p className="text-gray-600 mb-4">
                                    Мы используем cookies для сохранения настроек и улучшения работы сайта.
                                    Вы можете отключить cookies в настройках браузера.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5. Безопасность</h2>
                                <p className="text-gray-600 mb-4">
                                    Мы принимаем разумные меры для защиты ваших данных, включая шифрование
                                    передачи данных (HTTPS) и безопасное хранение.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6. Контакты</h2>
                                <p className="text-gray-600 mb-4">
                                    По всем вопросам, связанным с конфиденциальностью, вы можете связаться с нами
                                    через форму обратной связи на сайте.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-600 mb-4">
                                    This privacy policy describes how we collect, use, and protect your personal information.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">1. Information Collection</h2>
                                <p className="text-gray-600 mb-4">
                                    We collect the following information:
                                </p>
                                <ul className="list-disc pl-6 text-gray-600 mb-4">
                                    <li>Email address (if you choose to receive results via email)</li>
                                    <li>Test question responses</li>
                                    <li>Test results</li>
                                    <li>Payment information (processed by Stripe)</li>
                                </ul>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2. Data Usage</h2>
                                <p className="text-gray-600 mb-4">
                                    Collected data is used to:
                                </p>
                                <ul className="list-disc pl-6 text-gray-600 mb-4">
                                    <li>Calculate and display test results</li>
                                    <li>Send results to your email</li>
                                    <li>Process payments</li>
                                    <li>Improve service quality</li>
                                </ul>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3. Third-party Services</h2>
                                <p className="text-gray-600 mb-4">
                                    We use the following third-party services:
                                </p>
                                <ul className="list-disc pl-6 text-gray-600 mb-4">
                                    <li><strong>Stripe</strong> — for payment processing</li>
                                    <li><strong>Supabase</strong> — for data storage</li>
                                    <li><strong>Google Analytics</strong> — for analytics</li>
                                    <li><strong>Resend</strong> — for email delivery</li>
                                </ul>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4. Cookies</h2>
                                <p className="text-gray-600 mb-4">
                                    We use cookies to save settings and improve site functionality.
                                    You can disable cookies in your browser settings.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5. Security</h2>
                                <p className="text-gray-600 mb-4">
                                    We take reasonable measures to protect your data, including encrypted
                                    data transmission (HTTPS) and secure storage.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6. Contact</h2>
                                <p className="text-gray-600 mb-4">
                                    For any privacy-related questions, please contact us through the
                                    feedback form on the website.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
