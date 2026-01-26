import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function Terms() {
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
                        {lang === 'ru' ? 'Условия использования' : 'Terms of Use'}
                    </h1>

                    <div className="prose prose-gray max-w-none">
                        {lang === 'ru' ? (
                            <>
                                <p className="text-gray-600 mb-4">
                                    Используя данный сайт, вы соглашаетесь с настоящими условиями использования.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">1. Характер теста</h2>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                    <p className="text-amber-800 font-medium">
                                        ⚠️ Тест носит развлекательный характер и не является медицинской или психологической диагностикой.
                                    </p>
                                </div>
                                <p className="text-gray-600 mb-4">
                                    Результаты теста предоставляются исключительно в ознакомительных целях и не могут
                                    использоваться для постановки диагнозов или принятия важных жизненных решений.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2. Оплата</h2>
                                <p className="text-gray-600 mb-4">
                                    Для получения полных результатов теста требуется оплата.
                                    Оплата обрабатывается через безопасную платёжную систему Stripe.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3. Возврат средств</h2>
                                <p className="text-gray-600 mb-4">
                                    Поскольку результаты теста доставляются мгновенно в электронном виде,
                                    возврат средств после получения результатов невозможен.
                                    В случае технических проблем свяжитесь с нами для решения вопроса.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4. Интеллектуальная собственность</h2>
                                <p className="text-gray-600 mb-4">
                                    Все материалы сайта, включая тексты, вопросы и графику,
                                    защищены авторским правом. Копирование и распространение
                                    без разрешения запрещено.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5. Ограничение ответственности</h2>
                                <p className="text-gray-600 mb-4">
                                    Мы не несём ответственности за решения, принятые на основе результатов теста,
                                    а также за любые убытки, связанные с использованием сервиса.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6. Изменения условий</h2>
                                <p className="text-gray-600 mb-4">
                                    Мы оставляем за собой право изменять настоящие условия.
                                    Актуальная версия всегда доступна на этой странице.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-gray-600 mb-4">
                                    By using this website, you agree to these terms of use.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">1. Nature of the Test</h2>
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                    <p className="text-amber-800 font-medium">
                                        ⚠️ This test is for entertainment purposes only and is not a medical or psychological diagnosis.
                                    </p>
                                </div>
                                <p className="text-gray-600 mb-4">
                                    Test results are provided for informational purposes only and cannot be used
                                    for diagnosis or making important life decisions.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">2. Payment</h2>
                                <p className="text-gray-600 mb-4">
                                    Payment is required to receive full test results.
                                    Payments are processed through the secure Stripe payment system.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">3. Refunds</h2>
                                <p className="text-gray-600 mb-4">
                                    Since test results are delivered instantly in electronic form,
                                    refunds are not possible after receiving results.
                                    In case of technical issues, please contact us.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">4. Intellectual Property</h2>
                                <p className="text-gray-600 mb-4">
                                    All website materials, including texts, questions, and graphics,
                                    are protected by copyright. Copying and distribution
                                    without permission is prohibited.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">5. Limitation of Liability</h2>
                                <p className="text-gray-600 mb-4">
                                    We are not responsible for decisions made based on test results,
                                    or for any losses related to the use of the service.
                                </p>

                                <h2 className="text-xl font-semibold text-gray-800 mt-6 mb-3">6. Changes to Terms</h2>
                                <p className="text-gray-600 mb-4">
                                    We reserve the right to change these terms.
                                    The current version is always available on this page.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
