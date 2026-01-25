import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { useAdmin } from '../lib/AdminContext';
import { EditableField } from '../components/EditableField';
import type { HomeContent } from '../lib/supabase';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { lang } = useLanguage();
  const { isAdmin } = useAdmin();
  const [content, setContent] = useState<Record<string, string>>({});

  useEffect(() => {
    loadContent();
  }, [lang]);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const isPreview = searchParams.get('preview') === 'admin';

    // Admin preview mode - skip all verification
    if (isPreview || (sessionId === 'demo' && isAdmin)) {
      setProcessing(false);
      return;
    }

    // Demo session without admin - redirect to home
    if (sessionId === 'demo') {
      navigate('/');
      return;
    }

    if (sessionId) {
      handlePaymentSuccess(sessionId);
    } else {
      navigate('/');
    }
  }, [searchParams, navigate, isAdmin]);

  async function loadContent() {
    const { data } = await supabase
      .from('home_content')
      .select('*')
      .eq('language', lang);

    if (data) {
      const contentMap: Record<string, string> = {};
      data.forEach((item: HomeContent) => {
        contentMap[item.key] = item.value;
      });
      setContent(contentMap);
    }
  }

  async function saveContent(key: string, value: string) {
    const { error } = await supabase
      .from('home_content')
      .upsert({ key, value, language: lang }, { onConflict: 'key,language' });

    if (!error) {
      setContent(prev => ({ ...prev, [key]: value }));
    }
  }

  const getContent = (key: string, fallback: string) => content[key] || fallback;

  async function handlePaymentSuccess(stripeSessionId: string) {
    try {
      // Call edge function to verify payment and update session
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { stripeSessionId },
      });

      console.log('Verify payment response:', { data, error });

      if (error) throw error;

      // Check if data contains an error message
      if (data?.error) {
        throw new Error(data.error);
      }

      // Redirect to results page
      if (data?.testSessionId) {
        navigate(`/results/${data.testSessionId}`);
      } else {
        throw new Error('No test session ID returned');
      }
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setErrorMessage(err?.message || 'Unknown error occurred');
      setProcessing(false);
    }
  }

  const defaultTitle = lang === 'ru' ? 'Оплата прошла успешно!' : 'Payment Successful!';
  const defaultProcessing = lang === 'ru' ? 'Обрабатываем ваши результаты...' : 'Processing your results...';
  const defaultError = lang === 'ru' ? 'Что-то пошло не так. Свяжитесь с поддержкой.' : 'Something went wrong. Please contact support.';

  // Admin preview mode - show editable content
  const isPreview = searchParams.get('preview') === 'admin';
  if (!processing && isAdmin && isPreview) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            <EditableField
              value={getContent('payment_success_title', defaultTitle)}
              onSave={(value) => saveContent('payment_success_title', value)}
              as="span"
              className="text-2xl font-bold text-gray-900"
            />
          </h1>
          <p className="text-gray-500 mb-4">
            <EditableField
              value={getContent('payment_success_processing', defaultProcessing)}
              onSave={(value) => saveContent('payment_success_processing', value)}
              as="span"
              className="text-gray-500"
            />
          </p>
          <p className="text-sm text-indigo-600 bg-indigo-50 p-3 rounded-lg">
            Admin mode: This is how the page appears during processing
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
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {getContent('payment_success_title', defaultTitle)}
        </h1>
        <p className="text-gray-500 mb-4">
          {getContent('payment_success_processing', defaultProcessing)}
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  );
}
