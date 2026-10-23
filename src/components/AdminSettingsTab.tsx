import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Test } from '../lib/supabase';
import { Save, Check, Globe } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { useSiteSettings, supportHref } from '../lib/siteSettings';

interface AdminSettingsTabProps {
    tests: Test[];
}

type LanguageMode = 'ru' | 'en' | 'bilingual';

export function AdminSettingsTab({ tests }: AdminSettingsTabProps) {
    const { lang, languageMode, setLanguageMode } = useLanguage();
    const { supportContact, saveSupportContact } = useSiteSettings();
    const [contactDraft, setContactDraft] = useState<string | null>(null);
    const [savingContact, setSavingContact] = useState(false);
    const [contactSaved, setContactSaved] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [followUpTestSlug, setFollowUpTestSlug] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [savingLanguageMode, setSavingLanguageMode] = useState(false);
    const [languageModeSaved, setLanguageModeSaved] = useState(false);

    useEffect(() => {
        let cancelled=false;
        void supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'follow_up_test_slug')
            .maybeSingle().then(({data,error})=>{
                if(cancelled)return;
                if(error)setSaveError(lang==='ru'?'Не удалось загрузить настройки. Обновите страницу.':'Could not load settings. Please reload.');
                if(data)setFollowUpTestSlug(data.value||'');
                setLoading(false);
            });
        return ()=>{cancelled=true;};
    }, [lang]);

    async function saveFollowUpTestSlug() {
        setSaving(true);
        setSaved(false);

        setSaveError('');
        try {
            const { error } = await supabase.from('app_settings')
                .upsert({ key: 'follow_up_test_slug', value: followUpTestSlug, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch { setSaveError(lang === 'ru' ? 'Не удалось сохранить настройку. Попробуйте ещё раз.' : 'Could not save this setting. Please retry.'); }
        finally { setSaving(false); }
    }

    async function handleLanguageModeChange(mode: LanguageMode) {
        setSavingLanguageMode(true);
        setLanguageModeSaved(false);
        try {
            await setLanguageMode(mode);
            setLanguageModeSaved(true);
            setTimeout(() => setLanguageModeSaved(false), 2000);
        } catch (error) {
            console.error('Error saving language mode:', error);
            setSaveError(lang === 'ru' ? 'Не удалось сохранить язык. Попробуйте ещё раз.' : 'Could not save the language. Please retry.');
        }
        setSavingLanguageMode(false);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {saveError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{saveError}</p>}
            <form className="rounded-xl border bg-white p-6" onSubmit={async event => {
                event.preventDefault(); if (savingContact) return;
                setSavingContact(true); setContactSaved(false); setSaveError('');
                try { await saveSupportContact(contactDraft ?? supportContact); setContactDraft(null); setContactSaved(true); }
                catch { setSaveError(lang === 'ru' ? 'Не удалось сохранить контакт поддержки.' : 'Could not save the support contact.'); }
                finally { setSavingContact(false); }
            }}>
                <label htmlFor="support-contact" className="mb-2 block font-semibold">{lang === 'ru' ? 'Публичный контакт поддержки' : 'Public support contact'}</label>
                <p className="mb-3 text-sm text-gray-700">{lang === 'ru' ? 'Email или HTTPS-ссылка. Контакт показывается на сайте и при проблемах с оплатой.' : 'Email or HTTPS link, shown on the website and payment error screens.'}</p>
                <input id="support-contact" type="text" value={contactDraft ?? supportContact} onChange={e => { setContactDraft(e.target.value); setContactSaved(false); }} disabled={savingContact} className="w-full rounded-lg border px-3 py-2" required />
                <button type="submit" disabled={savingContact || !supportHref(contactDraft ?? supportContact)} className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">{savingContact ? (lang === 'ru' ? 'Сохранение…' : 'Saving…') : (lang === 'ru' ? 'Сохранить контакт' : 'Save contact')}</button>
                {contactSaved && <span role="status" className="ml-3 text-green-800">{lang === 'ru' ? 'Сохранено' : 'Saved'}</span>}
            </form>
            <h2 className="text-xl font-bold text-gray-900">
                {lang === 'ru' ? 'Настройки' : 'Settings'}
            </h2>

            {/* Language Mode Setting */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Globe className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-lg font-semibold text-gray-900">
                        {lang === 'ru' ? 'Режим языка' : 'Language Mode'}
                    </h3>
                    {languageModeSaved && (
                        <span className="text-sm text-green-600 flex items-center gap-1">
                            <Check className="w-4 h-4" />
                            {lang === 'ru' ? 'Сохранено' : 'Saved'}
                        </span>
                    )}
                    {savingLanguageMode && (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                    )}
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    {lang === 'ru'
                        ? 'Выберите язык отображения сайта для всех пользователей.'
                        : 'Select the display language for all users.'}
                </p>

                <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                            type="radio"
                            name="languageMode"
                            value="ru"
                            checked={languageMode === 'ru'}
                            onChange={() => handleLanguageModeChange('ru')}
                            className="w-4 h-4 text-indigo-600"
                            disabled={savingLanguageMode}
                        />
                        <div className="flex-1">
                            <span className="font-medium text-gray-900">🇷🇺 Русский</span>
                            <p className="text-sm text-gray-500">
                                {lang === 'ru' ? 'Сайт только на русском языке' : 'Site in Russian only'}
                            </p>
                        </div>
                        {languageMode === 'ru' && (
                            <span className="text-xs text-green-800 bg-green-100 px-2 py-1 rounded">
                                {lang === 'ru' ? 'По умолчанию' : 'Default'}
                            </span>
                        )}
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                            type="radio"
                            name="languageMode"
                            value="en"
                            checked={languageMode === 'en'}
                            onChange={() => handleLanguageModeChange('en')}
                            className="w-4 h-4 text-indigo-600"
                            disabled={savingLanguageMode}
                        />
                        <div className="flex-1">
                            <span className="font-medium text-gray-900">🇬🇧 English</span>
                            <p className="text-sm text-gray-500">
                                {lang === 'ru' ? 'Сайт только на английском языке' : 'Site in English only'}
                            </p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                            type="radio"
                            name="languageMode"
                            value="bilingual"
                            checked={languageMode === 'bilingual'}
                            onChange={() => handleLanguageModeChange('bilingual')}
                            className="w-4 h-4 text-indigo-600"
                            disabled={savingLanguageMode}
                        />
                        <div className="flex-1">
                            <span className="font-medium text-gray-900">🌐 {lang === 'ru' ? 'Двуязычный' : 'Bilingual'}</span>
                            <p className="text-sm text-gray-500">
                                {lang === 'ru' ? 'Пользователи могут переключать язык' : 'Users can switch language'}
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Follow-up Test Setting */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    {lang === 'ru' ? 'Кнопка «Узнать свои архетипы»' : 'Discover Your Archetypes Button'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    {lang === 'ru'
                        ? 'Выберите тест, на который будет вести кнопка в результатах. Эта кнопка отображается после прохождения теста в блоке с описанием архетипа.'
                        : 'Select the test that the button in results will lead to. This button is displayed after completing a test in the archetype description block.'}
                </p>

                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            {lang === 'ru' ? 'Целевой тест' : 'Target Test'}
                        </label>
                        <select
                            aria-label={lang==='ru'?'Целевой тест':'Target Test'}
                            value={followUpTestSlug}
                            onChange={(e) => setFollowUpTestSlug(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="">{lang === 'ru' ? '— Кнопка скрыта —' : '— Button hidden —'}</option>
                            {tests.map((test) => (
                                <option key={test.id} value={test.slug}>
                                    {test.title} ({test.slug})
                                </option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={saveFollowUpTestSlug}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    >
                        {saved ? (
                            <>
                                <Check className="w-4 h-4" />
                                {lang === 'ru' ? 'Сохранено' : 'Saved'}
                            </>
                        ) : saving ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                {lang === 'ru' ? 'Сохранение...' : 'Saving...'}
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                {lang === 'ru' ? 'Сохранить' : 'Save'}
                            </>
                        )}
                    </button>
                </div>

                {followUpTestSlug && (
                    <p className="text-sm text-gray-500 mt-3">
                        {lang === 'ru'
                            ? `Кнопка будет вести на: /${followUpTestSlug}`
                            : `Button will lead to: /${followUpTestSlug}`}
                    </p>
                )}
            </div>
        </div>
    );
}

