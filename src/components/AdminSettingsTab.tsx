import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Test } from '../lib/supabase';
import { Save, Check } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface AdminSettingsTabProps {
    tests: Test[];
}

export function AdminSettingsTab({ tests }: AdminSettingsTabProps) {
    const { lang } = useLanguage();
    const [followUpTestSlug, setFollowUpTestSlug] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    async function loadSettings() {
        setLoading(true);
        const { data } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'follow_up_test_slug')
            .single();

        if (data) {
            setFollowUpTestSlug(data.value || '');
        }
        setLoading(false);
    }

    async function saveFollowUpTestSlug() {
        setSaving(true);
        setSaved(false);

        // Try to update first
        const { error: updateError } = await supabase
            .from('app_settings')
            .update({ value: followUpTestSlug, updated_at: new Date().toISOString() })
            .eq('key', 'follow_up_test_slug');

        if (updateError) {
            // If update fails, try insert
            await supabase
                .from('app_settings')
                .insert({ key: 'follow_up_test_slug', value: followUpTestSlug });
        }

        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
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
            <h2 className="text-xl font-bold text-gray-900">
                {lang === 'ru' ? 'Настройки' : 'Settings'}
            </h2>

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
