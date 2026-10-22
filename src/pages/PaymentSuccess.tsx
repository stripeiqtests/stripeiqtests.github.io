import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { useAdmin } from '../lib/AdminContext';
import { EditableField } from '../components/EditableField';
import { trackPurchase } from '../lib/analytics';
import { useContent } from '../lib/useContent';
import { resultPath, storeSessionAccess } from '../lib/sessionAccess';
import { SupportLink } from '../components/SupportLink';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { lang } = useLanguage();
  const { isAdmin, authLoading } = useAdmin();
  const isPreview=isAdmin&&(searchParams.get('preview')==='admin'||searchParams.get('session_id')==='demo');
  const verificationLock = useRef(false);
  const { getContent, saveContent } = useContent();

  const handlePaymentSuccess = useCallback(async (stripeSessionId: string) => {
    if (verificationLock.current) return;
    verificationLock.current = true;
    setProcessing(true); setErrorMessage(null);
    try {
      // Call edge function to verify payment and update session
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { stripeSessionId },
      });

      if (error) throw error;

      // Check if data contains an error message
      if (data?.error) {
        throw new Error(data.error);
      }

      // Redirect to results page
      if (data?.success && data?.testSessionId && data?.resultAccessToken) {
        storeSessionAccess(data.testSessionId, data.resultAccessToken);
        // Track successful purchase
        void trackPurchase(data.testId || '', data.amountPaid ?? 0, 'USD', stripeSessionId);
        navigate(resultPath(data.testSessionId, data.resultAccessToken), { replace: true });
      } else {
        throw new Error('No test session ID returned');
      }
    } catch (err: unknown) {
      void err;
      setErrorMessage(lang === 'ru' ? 'Не удалось подтвердить статус. Если деньги списаны, не платите повторно: повторите проверку или обратитесь в поддержку.' : 'We could not confirm the status. If you were charged, do not pay again: retry verification or contact support.');
      setProcessing(false);
    } finally { verificationLock.current = false; }
  }, [navigate, lang]);

  useEffect(() => {
    if (authLoading) return;
    const sessionId = searchParams.get('session_id');

    // Admin preview mode - skip all verification
    if (isPreview) return;

    // Demo session without admin - redirect to home
    if (sessionId === 'demo') {
      navigate('/');
      return;
    }

    if (sessionId) {
      // Start an external payment verification; the loading state is also used by retry.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void handlePaymentSuccess(sessionId);
    } else {
      navigate('/');
    }
  }, [handlePaymentSuccess, searchParams, navigate, isAdmin, authLoading, isPreview]);

  const defaultTitle = lang === 'ru' ? 'Оплата прошла успешно!' : 'Payment Successful!';
  const defaultProcessing = lang === 'ru' ? 'Обрабатываем ваши результаты...' : 'Processing your results...';
  const defaultError = lang === 'ru' ? 'Что-то пошло не так. Свяжитесь с поддержкой.' : 'Something went wrong. Please contact support.';

  // Admin preview mode - show editable content (or static preview if not logged in)
  if (!authLoading && isPreview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isAdmin ? (
              <EditableField
                value={getContent('payment_success_title', defaultTitle)}
                onSave={(value) => saveContent('payment_success_title', value)}
                as="span"
                className="text-2xl font-bold text-gray-900"
              />
            ) : (
              getContent('payment_success_title', defaultTitle)
            )}
          </h1>
          <div className="text-gray-500 mb-4">
            {isAdmin ? (
              <EditableField
                value={getContent('payment_success_processing', defaultProcessing)}
                onSave={(value) => saveContent('payment_success_processing', value)}
                as="span"
                className="text-gray-500"
              />
            ) : (
              getContent('payment_success_processing', defaultProcessing)
            )}
          </div>
          <p className="text-sm text-indigo-600 bg-indigo-50 p-3 rounded-lg">
            {isAdmin
              ? (lang === 'ru' ? 'Режим редактирования: нажмите на текст для изменения' : 'Edit mode: click text to edit')
              : (lang === 'ru' ? 'Превью страницы оплаты' : 'Payment page preview')
            }
          </p>
        </div>
      </div>
    );
  }

  if (!processing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <p className="text-gray-500 mb-4">
            {isAdmin ? (
              <EditableField
                value={getContent('payment_success_error', defaultError)}
                onSave={(value) => saveContent('payment_success_error', value)}
                as="span"
                className="text-gray-500"
              />
            ) : (
              getContent('payment_success_error', defaultError)
            )}
          </p>
          {errorMessage && (
            <p className="text-red-500 text-sm bg-red-50 p-3 rounded-lg">{errorMessage}</p>
          )}
          <button className="my-4 rounded-lg bg-indigo-600 px-5 py-3 text-white" onClick={() => void handlePaymentSuccess(searchParams.get('session_id') ?? '')}>{lang === 'ru' ? 'Повторить проверку' : 'Retry verification'}</button>
          <p><SupportLink /></p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {lang === 'ru' ? 'Подтверждаем оплату' : 'Confirming payment'}
        </h1>
        <p className="text-gray-500 mb-4">
          {getContent('payment_success_processing', defaultProcessing)}
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  );
}
