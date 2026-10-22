import { useState, useEffect } from 'react';
import { useLanguage } from '../lib/i18n';
import { readConsent, setConsent } from '../lib/consent';
import { initializeAnalytics, disableAnalytics } from '../lib/analytics';


export function CookieConsent() {
    const [isVisible, setIsVisible] = useState(() => !readConsent());
    const { lang } = useLanguage();

    useEffect(() => {
        const update = () => {
            if (readConsent() === 'granted') initializeAnalytics();
            else disableAnalytics();
            setIsVisible(!readConsent());
        };
        const open = () => setIsVisible(true);
        update();
        window.addEventListener('inner-code:consent-changed', update);
        window.addEventListener('inner-code:open-consent', open);
        window.addEventListener('storage', update);
        return () => {
            window.removeEventListener('inner-code:consent-changed', update);
            window.removeEventListener('inner-code:open-consent', open);
            window.removeEventListener('storage', update);
        };
    }, []);

    const handleAccept = () => {
        setConsent('granted');
        setIsVisible(false);
    };

    const handleClose = () => {
        setConsent('denied');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <aside aria-label={lang === 'ru' ? 'Настройки cookies' : 'Cookie settings'} className="border-b border-gray-200 bg-white px-4 py-3">
            <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex-1">
                        <p className="text-gray-700 text-sm sm:text-base">
                            {lang === 'ru'
                                ? 'Разрешить необязательную аналитику? Ответы сохраняются и сайт работает при любом выборе. '
                                : 'Allow optional analytics? Answers are saved and the site works with either choice. '}
                            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-indigo-700 underline">
                                {lang === 'ru' ? 'Подробнее' : 'Learn more'}
                            </a>
                        </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            onClick={handleAccept}
                            className="flex-1 sm:flex-none px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                        >
                            {lang === 'ru' ? 'Разрешить' : 'Allow'}
                        </button>
                        <button
                            onClick={handleClose}
                            className="flex-1 rounded-lg border border-gray-400 px-4 py-2 font-medium text-gray-800"
                        >
                            {lang === 'ru' ? 'Отклонить' : 'Decline'}
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
