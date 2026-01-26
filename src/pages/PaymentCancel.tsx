import { useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { useAdmin } from '../lib/AdminContext';
import { EditableField } from '../components/EditableField';
import { trackPaymentCancel } from '../lib/analytics';
import { useContent } from '../lib/useContent';

export function PaymentCancel() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const { lang } = useLanguage();
  const { isAdmin } = useAdmin();
  const { getContent, saveContent } = useContent();

  // Track payment cancellation event
  useEffect(() => {
    trackPaymentCancel();
  }, []);

  const defaultTitle = lang === 'ru' ? 'Оплата отменена' : 'Payment Cancelled';
  const defaultMessage = lang === 'ru'
    ? 'Оплата была отменена. Вы можете попробовать снова в любое время.'
    : 'Your payment was cancelled. You can try again anytime.';
  const defaultButton = lang === 'ru' ? 'Попробовать снова' : 'Try Again';
  const defaultHomeButton = lang === 'ru' ? 'На главную' : 'Back to Home';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isAdmin ? (
            <EditableField
              value={getContent('payment_cancel_title', defaultTitle)}
              onSave={(value) => saveContent('payment_cancel_title', value)}
              as="span"
              className="text-2xl font-bold text-gray-900"
            />
          ) : (
            getContent('payment_cancel_title', defaultTitle)
          )}
        </h1>
        <div className="text-gray-500 mb-6">
          {isAdmin ? (
            <EditableField
              value={getContent('payment_cancel_message', defaultMessage)}
              onSave={(value) => saveContent('payment_cancel_message', value)}
              as="span"
              className="text-gray-500"
              multiline
            />
          ) : (
            getContent('payment_cancel_message', defaultMessage)
          )}
        </div>

        {sessionId ? (
          <Link
            to={`/results/${sessionId}`}
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700"
          >
            {getContent('payment_cancel_button', defaultButton)}
          </Link>
        ) : (
          <Link
            to="/"
            className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700"
          >
            {getContent('payment_cancel_home_button', defaultHomeButton)}
          </Link>
        )}
      </div>
    </div>
  );
}
