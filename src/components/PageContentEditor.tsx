import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { HomeContent } from '../lib/supabase';
import { ChevronDown, ChevronUp, CheckCircle, XCircle, CreditCard, Lock, AlertCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';
import { EditableField } from './EditableField';

// Page preview components with inline editing
function PaymentSuccessPreview({ content, saveContent }: { content: Record<string, string>, saveContent: (key: string, value: string) => Promise<void> }) {
    const { lang } = useLanguage();
    const getContent = (key: string) => content[`${key}_${lang}`] || '';

    return (
        <div className="bg-gradient-to-br from-green-50 to-emerald-100 rounded-xl p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <EditableField
                value={getContent('payment_success_title')}
                onSave={(val) => saveContent(`payment_success_title_${lang}`, val)}
                as="h2"
                className="text-2xl font-bold text-gray-900 mb-2"
            />
            <EditableField
                value={getContent('payment_success_processing')}
                onSave={(val) => saveContent(`payment_success_processing_${lang}`, val)}
                as="p"
                className="text-gray-600"
            />
            <div className="mt-6 p-4 bg-red-50 rounded-lg border border-red-200">
                <AlertCircle className="w-5 h-5 text-red-500 mx-auto mb-2" />
                <EditableField
                    value={getContent('payment_error')}
                    onSave={(val) => saveContent(`payment_error_${lang}`, val)}
                    as="p"
                    className="text-red-600 text-sm"
                />
            </div>
        </div>
    );
}

function PaymentCancelPreview({ content, saveContent }: { content: Record<string, string>, saveContent: (key: string, value: string) => Promise<void> }) {
    const { lang } = useLanguage();
    const getContent = (key: string) => content[`${key}_${lang}`] || '';

    return (
        <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-xl p-8 text-center">
            <XCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <EditableField
                value={getContent('payment_cancel_title')}
                onSave={(val) => saveContent(`payment_cancel_title_${lang}`, val)}
                as="h2"
                className="text-2xl font-bold text-gray-900 mb-2"
            />
            <EditableField
                value={getContent('payment_cancel_message')}
                onSave={(val) => saveContent(`payment_cancel_message_${lang}`, val)}
                as="p"
                className="text-gray-600 mb-6"
                multiline
            />
            <div className="flex gap-4 justify-center">
                <EditableField
                    value={getContent('try_again_button')}
                    onSave={(val) => saveContent(`try_again_button_${lang}`, val)}
                    as="span"
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium"
                />
                <EditableField
                    value={getContent('back_to_home')}
                    onSave={(val) => saveContent(`back_to_home_${lang}`, val)}
                    as="span"
                    className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium"
                />
            </div>
        </div>
    );
}

function ResultsPreview({ content, saveContent }: { content: Record<string, string>, saveContent: (key: string, value: string) => Promise<void> }) {
    const { lang } = useLanguage();
    const getContent = (key: string) => content[`${key}_${lang}`] || '';

    return (
        <div className="space-y-6">
            {/* Session Not Found State */}
            <div className="bg-gradient-to-br from-gray-50 to-slate-100 rounded-xl p-8 text-center">
                <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <EditableField
                    value={getContent('session_not_found_title')}
                    onSave={(val) => saveContent(`session_not_found_title_${lang}`, val)}
                    as="h2"
                    className="text-2xl font-bold text-gray-900 mb-2"
                />
                <EditableField
                    value={getContent('session_not_found_message')}
                    onSave={(val) => saveContent(`session_not_found_message_${lang}`, val)}
                    as="p"
                    className="text-gray-600 mb-6"
                    multiline
                />
                <EditableField
                    value={getContent('take_new_test')}
                    onSave={(val) => saveContent(`take_new_test_${lang}`, val)}
                    as="span"
                    className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium"
                />
            </div>

            {/* Unlock Results State */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-100 rounded-xl p-8 text-center">
                <Lock className="w-16 h-16 text-indigo-500 mx-auto mb-4" />
                <EditableField
                    value={getContent('test_completed_title')}
                    onSave={(val) => saveContent(`test_completed_title_${lang}`, val)}
                    as="h2"
                    className="text-2xl font-bold text-gray-900 mb-2"
                />
                <EditableField
                    value={getContent('unlock_results')}
                    onSave={(val) => saveContent(`unlock_results_${lang}`, val)}
                    as="p"
                    className="text-gray-600 mb-4"
                />
                <div className="flex items-center justify-center gap-2 text-gray-500 mb-4">
                    <CreditCard className="w-4 h-4" />
                    <EditableField
                        value={getContent('one_time_payment')}
                        onSave={(val) => saveContent(`one_time_payment_${lang}`, val)}
                        as="span"
                        className="text-sm"
                    />
                </div>
                <EditableField
                    value={getContent('secure_payment')}
                    onSave={(val) => saveContent(`secure_payment_${lang}`, val)}
                    as="p"
                    className="text-xs text-gray-400"
                />
            </div>
        </div>
    );
}

// Page sections configuration
const PAGE_SECTIONS = [
    { key: 'payment_success', label: 'admin.payment_success', Preview: PaymentSuccessPreview },
    { key: 'payment_cancel', label: 'admin.payment_cancel', Preview: PaymentCancelPreview },
    { key: 'results', label: 'admin.results_page', Preview: ResultsPreview },
];

export function PageContentEditor({ pageType }: { pageType?: 'success' | 'cancel' | 'results' }) {
    const { t, lang } = useLanguage();
    const [content, setContent] = useState<Record<string, string>>({});

    // Map pageType to section key
    const pageTypeToKey: Record<string, string> = {
        'success': 'payment_success',
        'cancel': 'payment_cancel',
        'results': 'results',
    };

    // If pageType is specified, show that section expanded by default
    const [expandedPage, setExpandedPage] = useState<string | null>(
        pageType ? pageTypeToKey[pageType] : null
    );

    useEffect(() => {
        // The request resolves before it updates local UI state.
        // eslint-disable-next-line react-hooks/immutability
        loadContent();
    }, []);

    async function loadContent() {
        const { data, error } = await supabase
            .from('home_content')
            .select('*');

        if (error) {
            console.error('Error loading content:', error);
            return;
        }

        const contentMap: Record<string, string> = {};
        (data as HomeContent[] || []).forEach(item => {
            contentMap[item.key] = item.value;
        });
        setContent(contentMap);
    }

    async function saveContent(key: string, value: string) {
        const { error } = await supabase
            .from('home_content')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', key);

        if (error) {
            console.error('Error saving:', error);
            throw error;
        }

        setContent(prev => ({ ...prev, [key]: value }));
    }

    // Filter sections if pageType is specified
    const sectionsToShow = pageType
        ? PAGE_SECTIONS.filter(s => s.key === pageTypeToKey[pageType])
        : PAGE_SECTIONS;

    // If showing single page, render just the preview without accordion
    if (pageType && sectionsToShow.length === 1) {
        const { Preview } = sectionsToShow[0];
        return (
            <div className="p-6">
                <p className="text-sm text-gray-500 mb-4">
                    {lang === 'ru' ? 'Нажмите на карандаш для редактирования текста' : 'Click pencil icons to edit text'}
                </p>
                <Preview content={content} saveContent={saveContent} />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">{t('admin.page_content')}</h2>
                <p className="text-sm text-gray-500">
                    {lang === 'ru' ? 'Нажмите на карандаш для редактирования' : 'Click pencil icons to edit'}
                </p>
            </div>

            {sectionsToShow.map(({ key, label, Preview }) => (
                <div key={key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <button
                        onClick={() => setExpandedPage(expandedPage === key ? null : key)}
                        className="w-full px-4 py-3 flex justify-between items-center hover:bg-gray-50"
                    >
                        <span className="font-semibold text-gray-900">{t(label)}</span>
                        {expandedPage === key ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                    </button>

                    {expandedPage === key && (
                        <div className="border-t border-gray-200 p-4">
                            <Preview content={content} saveContent={saveContent} />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

