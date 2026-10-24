import { useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle } from 'lucide-react';
import { useLanguage, LanguageSwitcher } from '../lib/i18n';
import { useAdmin } from '../lib/AdminContext';
import { EditableField } from '../components/EditableField';
import { trackPurchase } from '../lib/analytics';
import { useContent } from '../lib/useContent';
import { resultPath, storeSessionAccess } from '../lib/sessionAccess';
import { SupportLink } from '../components/SupportLink';
import { usePresentation } from '../lib/usePresentation';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [verificationFailed, setVerificationFailed] = useState(false);
  const { lang } = useLanguage();
  const { isAdmin, authLoading } = useAdmin();
  const isPreview=isAdmin&&(searchParams.get('preview')==='admin'||searchParams.get('session_id')==='demo');
  const verificationGeneration = useRef(0);
  const verificationRequest = useRef<{checkoutId:string;controller:AbortController}|null>(null);
  const { getContent, saveContent } = useContent();
  const {presentation} = usePresentation();
  const contentKey = (name:string) => `${name}_${lang}`;
  const errorMessage=verificationFailed ? (lang === 'ru' ? 'Не удалось подтвердить статус. Если деньги списаны, не платите повторно: повторите проверку или обратитесь в поддержку.' : 'We could not confirm the status. If you were charged, do not pay again: retry verification or contact support.') : null;

  const handlePaymentSuccess = useCallback(async (stripeSessionId: string) => {
    if(verificationRequest.current?.checkoutId===stripeSessionId)return;
    const generation=++verificationGeneration.current;
    verificationRequest.current?.controller.abort();
    const controller=new AbortController();
    verificationRequest.current={checkoutId:stripeSessionId,controller};
    setProcessing(true); setVerificationFailed(false);
    try {
      if(!/^cs_(test|live)_[A-Za-z0-9]+$/.test(stripeSessionId))throw new Error('Invalid checkout ID');
      // Call edge function to verify payment and update session
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { stripeSessionId },
        signal:controller.signal,
        timeout:20000,
      });

      if(generation!==verificationGeneration.current||controller.signal.aborted)return;
      if (error) throw error;

      // Check if data contains an error message
      if (data?.error) {
        throw new Error(data.error);
      }

      // Redirect to results page
      const validUuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      if (data?.success===true && validUuid(data.testSessionId) && validUuid(data.resultAccessToken)) {
        storeSessionAccess(data.testSessionId, data.resultAccessToken);
        // Track successful purchase
        void trackPurchase(data.testId || '', data.amountPaid ?? 0, 'USD', stripeSessionId);
        navigate(resultPath(data.testSessionId, data.resultAccessToken), { replace: true });
      } else {
        throw new Error('No test session ID returned');
      }
    } catch {
      if(generation===verificationGeneration.current&&!controller.signal.aborted){
        setVerificationFailed(true);setProcessing(false);
      }
    } finally { if(generation===verificationGeneration.current)verificationRequest.current=null; }
  }, [navigate]);

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
      void handlePaymentSuccess(sessionId);
    } else {
      navigate('/');
    }
  }, [handlePaymentSuccess, searchParams, navigate, isAdmin, authLoading, isPreview]);

  // Leaving/changing the return URL invalidates its response, including a slow
  // successful verification for a checkout the visitor is no longer viewing.
  useEffect(()=>()=>{
    verificationGeneration.current++;
    verificationRequest.current?.controller.abort();
    verificationRequest.current=null;
  },[searchParams,isPreview]);

  const defaultTitle = lang === 'ru' ? 'Оплата прошла успешно!' : 'Payment Successful!';
  const defaultProcessing = lang === 'ru' ? 'Обрабатываем ваши результаты...' : 'Processing your results...';
  const defaultError = lang === 'ru' ? 'Что-то пошло не так. Свяжитесь с поддержкой.' : 'Something went wrong. Please contact support.';

  // Only an authenticated administrator can enter the editable preview.
  if (!authLoading && isPreview) {
    return (
      <div role="main" className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <div className="flex justify-end mb-4"><LanguageSwitcher /></div>
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <EditableField
            key={contentKey('payment_success_title')}
            value={getContent(contentKey('payment_success_title'), defaultTitle)}
            onSave={(value) => saveContent(contentKey('payment_success_title'), value)}
            as="h1"
            className="text-2xl font-bold text-gray-900 mb-2"
          />
          <div className="text-gray-500 mb-4">
            <EditableField
              key={contentKey('payment_success_processing')}
              value={getContent(contentKey('payment_success_processing'), defaultProcessing)}
              onSave={(value) => saveContent(contentKey('payment_success_processing'), value)}
              as="span"
              className="text-gray-500"
            />
          </div>
          <p className="text-sm text-indigo-600 bg-indigo-50 p-3 rounded-lg">
            {lang === 'ru' ? 'Режим редактирования: нажмите на текст для изменения' : 'Edit mode: click text to edit'}
          </p>
        </div>
      </div>
    );
  }

  if (!processing) {
    return (
      <div role="main" className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-900 mb-3">{lang==='ru'?'Не удалось подтвердить оплату':'Could not confirm payment'}</h1>
          <div className="text-gray-500 mb-4">
            {isAdmin ? (
              <EditableField
                key={contentKey('payment_error')}
                value={getContent(contentKey('payment_error'), defaultError)}
                onSave={(value) => saveContent(contentKey('payment_error'), value)}
                as="span"
                className="text-gray-500"
              />
            ) : (
              getContent(contentKey('payment_error'), defaultError)
            )}
          </div>
          {errorMessage && (
            <p role="alert" className="text-red-800 text-sm bg-red-50 p-3 rounded-lg">{errorMessage}</p>
          )}
          <button className="my-4 rounded-lg bg-indigo-600 px-5 py-3 text-white" onClick={() => void handlePaymentSuccess(searchParams.get('session_id') ?? '')}>{lang === 'ru' ? 'Повторить проверку' : 'Retry verification'}</button>
          <p><SupportLink /></p>
        </div>
      </div>
    );
  }

  return (
    <div role="main" className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {presentation.messages.paymentConfirming[lang === 'ru' ? 'ru' : 'en']}
        </h1>
        <p className="text-gray-500 mb-4">
          {getContent(contentKey('payment_success_processing'), defaultProcessing)}
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  );
}
