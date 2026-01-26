import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ArchetypeResult } from '../lib/supabase';
import { Save, Brain, Target, Eye, Sparkles, AlertCircle, CheckCircle } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

const DIMENSION_INFO = {
    analyst: {
        icon: Brain,
        labelRu: 'Аналитик',
        labelEn: 'Analyst',
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
    },
    strategist: {
        icon: Target,
        labelRu: 'Стратег',
        labelEn: 'Strategist',
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
    },
    observer: {
        icon: Eye,
        labelRu: 'Наблюдатель',
        labelEn: 'Observer',
        color: 'text-green-600',
        bg: 'bg-green-50',
        border: 'border-green-200',
    },
    intuitive: {
        icon: Sparkles,
        labelRu: 'Интуит',
        labelEn: 'Intuitive',
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
    },
};

type Dimension = keyof typeof DIMENSION_INFO;

export function AdminArchetypesTab() {
    const [archetypes, setArchetypes] = useState<ArchetypeResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<string | null>(null);
    const [editingDimension, setEditingDimension] = useState<Dimension | null>(null);
    const [editForm, setEditForm] = useState<Partial<ArchetypeResult>>({});
    const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const { lang } = useLanguage();

    useEffect(() => {
        loadArchetypes();
    }, []);

    async function loadArchetypes() {
        setLoading(true);
        const { data, error } = await supabase
            .from('archetype_results')
            .select('*')
            .order('dimension');

        if (error) {
            console.error('Error loading archetypes:', error);
            // If table doesn't exist, we'll create default entries
            if (error.code === '42P01') {
                console.log('archetype_results table does not exist - needs to be created');
            }
        } else {
            setArchetypes(data || []);
        }
        setLoading(false);
    }

    function startEditing(dimension: Dimension) {
        const existing = archetypes.find(a => a.dimension === dimension);
        setEditingDimension(dimension);
        setEditForm(existing || {
            dimension,
            title_ru: `🧠 ОБРАЗ МЫШЛЕНИЯ: ${DIMENSION_INFO[dimension].labelRu.toUpperCase()}`,
            title_en: `🧠 THINKING STYLE: ${DIMENSION_INFO[dimension].labelEn.toUpperCase()}`,
            content_ru: '',
            content_en: '',
        });
    }

    async function handleSave() {
        if (!editingDimension) return;

        setSaving(editingDimension);
        setSaveStatus(null);

        const existing = archetypes.find(a => a.dimension === editingDimension);

        try {
            if (existing) {
                // Update existing
                const { error } = await supabase
                    .from('archetype_results')
                    .update({
                        title_ru: editForm.title_ru,
                        title_en: editForm.title_en,
                        content_ru: editForm.content_ru,
                        content_en: editForm.content_en,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', existing.id);

                if (error) throw error;
            } else {
                // Insert new
                const { error } = await supabase
                    .from('archetype_results')
                    .insert({
                        dimension: editingDimension,
                        title_ru: editForm.title_ru,
                        title_en: editForm.title_en,
                        content_ru: editForm.content_ru,
                        content_en: editForm.content_en,
                    });

                if (error) throw error;
            }

            setSaveStatus({ type: 'success', message: lang === 'ru' ? 'Сохранено!' : 'Saved!' });
            await loadArchetypes();
            setTimeout(() => {
                setEditingDimension(null);
                setSaveStatus(null);
            }, 1500);
        } catch (err: any) {
            console.error('Error saving archetype:', err);
            setSaveStatus({
                type: 'error',
                message: lang === 'ru' ? `Ошибка: ${err.message}` : `Error: ${err.message}`
            });
        }

        setSaving(null);
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
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        {lang === 'ru' ? 'Описания архетипов' : 'Archetype Descriptions'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {lang === 'ru'
                            ? 'Редактируйте тексты результатов для каждого типа мышления'
                            : 'Edit result texts for each thinking type'}
                    </p>
                </div>
            </div>

            <div className="grid gap-4">
                {(Object.keys(DIMENSION_INFO) as Dimension[]).map((dimension) => {
                    const info = DIMENSION_INFO[dimension];
                    const Icon = info.icon;
                    const existing = archetypes.find(a => a.dimension === dimension);
                    const isEditing = editingDimension === dimension;

                    return (
                        <div
                            key={dimension}
                            className={`border rounded-xl overflow-hidden ${info.border} ${isEditing ? 'ring-2 ring-indigo-500' : ''}`}
                        >
                            <div
                                className={`${info.bg} px-4 py-3 flex items-center justify-between cursor-pointer`}
                                onClick={() => !isEditing && startEditing(dimension)}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon className={`w-5 h-5 ${info.color}`} />
                                    <div>
                                        <span className={`font-semibold ${info.color}`}>
                                            {lang === 'ru' ? info.labelRu : info.labelEn}
                                        </span>
                                        {existing ? (
                                            <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                                                {lang === 'ru' ? 'Настроено' : 'Configured'}
                                            </span>
                                        ) : (
                                            <span className="ml-2 text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                                                {lang === 'ru' ? 'Не настроено' : 'Not configured'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {!isEditing && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); startEditing(dimension); }}
                                        className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        {lang === 'ru' ? 'Редактировать' : 'Edit'}
                                    </button>
                                )}
                            </div>

                            {isEditing && (
                                <div className="p-4 bg-white space-y-4">
                                    {/* Title RU */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Заголовок (RU)
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.title_ru || ''}
                                            onChange={(e) => setEditForm({ ...editForm, title_ru: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="🧠 ОБРАЗ МЫШЛЕНИЯ: АНАЛИТИК"
                                        />
                                    </div>

                                    {/* Title EN */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Title (EN)
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.title_en || ''}
                                            onChange={(e) => setEditForm({ ...editForm, title_en: e.target.value })}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                            placeholder="🧠 THINKING STYLE: ANALYST"
                                        />
                                    </div>

                                    {/* Content RU */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Содержимое (RU)
                                        </label>
                                        <textarea
                                            value={editForm.content_ru || ''}
                                            onChange={(e) => setEditForm({ ...editForm, content_ru: e.target.value })}
                                            rows={12}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                                            placeholder="Полное описание результата на русском языке..."
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Используйте **текст** для жирного, *текст* для курсива
                                        </p>
                                    </div>

                                    {/* Content EN */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Content (EN)
                                        </label>
                                        <textarea
                                            value={editForm.content_en || ''}
                                            onChange={(e) => setEditForm({ ...editForm, content_en: e.target.value })}
                                            rows={12}
                                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                                            placeholder="Full result description in English..."
                                        />
                                    </div>

                                    {/* Save Status */}
                                    {saveStatus && (
                                        <div className={`flex items-center gap-2 p-3 rounded-lg ${saveStatus.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                                            }`}>
                                            {saveStatus.type === 'success' ? (
                                                <CheckCircle className="w-4 h-4" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4" />
                                            )}
                                            {saveStatus.message}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex gap-3 pt-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving === dimension}
                                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            <Save className="w-4 h-4" />
                                            {saving === dimension
                                                ? (lang === 'ru' ? 'Сохранение...' : 'Saving...')
                                                : (lang === 'ru' ? 'Сохранить' : 'Save')}
                                        </button>
                                        <button
                                            onClick={() => setEditingDimension(null)}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                                        >
                                            {lang === 'ru' ? 'Отмена' : 'Cancel'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
