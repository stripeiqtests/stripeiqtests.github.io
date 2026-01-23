import { useSearchParams, Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { lang } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {lang === 'ru' ? 'Оплата отменена' : 'Payment Cancelled'}
        </h1>
        <p className="text-gray-500 mb-6">
          {lang === 'ru'
            ? 'Оплата была отменена. Вы можете попробовать снова в любое время.'
            : 'Your payment was cancelled. You can try again anytime.'
          }
        </p>

        {sessionId ? (
          <Link
            to={`/results/${sessionId}`}
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700"
          >
            {lang === 'ru' ? 'Попробовать снова' : 'Try Again'}
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700"
          >
            {lang === 'ru' ? 'На главную' : 'Back to Home'}
          </Link>
        )}
      </div>
    </div>
  );
}
