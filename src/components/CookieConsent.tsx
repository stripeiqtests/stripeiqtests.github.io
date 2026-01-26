import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

const CONSENT_KEY = 'cookie_consent_accepted';

export function CookieConsent() {
    const [isVisible, setIsVisible] = useState(false);
    const { lang } = useLanguage();

    useEffect(() => {
        // Check if consent was already given
        const consent = localStorage.getItem(CONSENT_KEY);
        if (!consent) {
            // Show banner after a short delay for better UX
            const timer = setTimeout(() => setIsVisible(true), 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const handleAccept = () => {
        localStorage.setItem(CONSENT_KEY, 'true');
        setIsVisible(false);
    };

    const handleClose = () => {
        // Just hide without saving - will show again on next visit
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-slide-up">
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-2xl border border-gray-200 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                        <p className="text-gray-700 text-sm sm:text-base">
                            {lang === 'ru'
                                ? '🍪 Этот сайт использует cookies для улучшения работы и аналитики. Продолжая использовать сайт, вы соглашаетесь с нашей '
                                : '🍪 This site uses cookies to improve functionality and analytics. By continuing to use the site, you agree to our '}
                            <a href="/privacy" className="text-indigo-600 hover:underline">
                                {lang === 'ru' ? 'политикой конфиденциальности' : 'privacy policy'}
                            </a>.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleAccept}
                            className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                        >
                            {lang === 'ru' ? 'Принять' : 'Accept'}
                        </button>
                        <button
                            onClick={handleClose}
                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
