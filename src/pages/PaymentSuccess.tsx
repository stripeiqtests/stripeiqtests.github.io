import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

export function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    if (sessionId) {
      handlePaymentSuccess(sessionId);
    } else {
      navigate('/');
    }
  }, [searchParams, navigate]);

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

  if (!processing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-md">
          <p className="text-gray-500 mb-4">
            {lang === 'ru' ? 'Что-то пошло не так. Свяжитесь с поддержкой.' : 'Something went wrong. Please contact support.'}
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
          {lang === 'ru' ? 'Оплата прошла успешно!' : 'Payment Successful!'}
        </h1>
        <p className="text-gray-500 mb-4">
          {lang === 'ru' ? 'Обрабатываем ваши результаты...' : 'Processing your results...'}
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  );
}
