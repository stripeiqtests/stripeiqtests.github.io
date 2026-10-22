import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X, LoaderCircle } from 'lucide-react';
import { useAdmin } from '../lib/AdminContext';
import { useLanguage } from '../lib/i18n';

interface EditableFieldProps {
    value: string;
    onSave: (value: string) => Promise<void>;
    as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span';
    className?: string;
    multiline?: boolean;
}

export function EditableField({
    value,
    onSave,
    as: Component = 'span',
    className = '',
    multiline = false
}: EditableFieldProps) {
    const { isAdmin } = useAdmin();
    const { t, lang } = useLanguage();
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const hasChanges = editValue !== value;

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (isSaving) return;
        if (!hasChanges) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave(editValue);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save:', error);
            setSaveError(lang === 'ru'
                ? 'Не удалось сохранить. Попробуйте ещё раз.'
                : 'Could not save. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        if (isSaving) return;
        setEditValue(value);
        setSaveError(null);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (isSaving) return;
        if (e.key === 'Enter' && !multiline) {
            e.preventDefault();
            void handleSave();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            handleCancel();
        }
    };

    // Non-admin view - just render the text
    if (!isAdmin) {
        return <Component className={className}>{value}</Component>;
    }

    // Admin editing mode
    if (isEditing) {
        const inputClasses = `
      w-full bg-white border-2 border-indigo-500 rounded-lg px-3 py-2
      focus:outline-none focus:ring-2 focus:ring-indigo-300
      ${className}
    `.trim();

        return (
            <div className="relative inline-block w-full min-w-0 align-top" aria-busy={isSaving}>
                {multiline ? (
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={(e) => { setEditValue(e.target.value); setSaveError(null); }}
                        onKeyDown={handleKeyDown}
                        className={inputClasses}
                        style={{ paddingRight: '5rem' }}
                        rows={3}
                        disabled={isSaving}
                    />
                ) : (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={editValue}
                        onChange={(e) => { setEditValue(e.target.value); setSaveError(null); }}
                        onKeyDown={handleKeyDown}
                        className={inputClasses}
                        style={{ paddingRight: '5rem' }}
                        disabled={isSaving}
                    />
                )}
                {saveError && <p role="alert" className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700 shadow-md">{saveError}</p>}
                <div className={`absolute right-1.5 z-10 flex gap-1 rounded-md bg-white p-0.5 ${multiline ? 'top-2' : 'top-1/2 -translate-y-1/2'}`}>
                    <button
                        type="button"
                        onClick={handleCancel}
                        aria-label={t('common.cancel')}
                        title={t('common.cancel')}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${hasChanges
                            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                            : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100'}`}
                        disabled={isSaving}
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        aria-label={t('admin.save')}
                        title={t('admin.save')}
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${hasChanges
                            ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60'
                            : 'border-gray-200 bg-gray-100 text-gray-400'}`}
                        disabled={isSaving || !hasChanges}
                    >
                        {isSaving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        );
    }

    // Admin view mode with always-visible edit icon
    return (
        <div
            className="relative inline-flex items-center gap-2 group cursor-pointer"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onClick={() => { setEditValue(value); setSaveError(null); setIsEditing(true); }}
        >
            <Component className={`${className} ${isHovered ? 'bg-indigo-50 rounded' : ''}`}>
                {value}
            </Component>
            <button
                className={`p-2 rounded-lg border-2 transition-all cursor-pointer ${isHovered
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                    : 'bg-transparent text-indigo-500 border-indigo-300 hover:border-indigo-500'
                    }`}
                onClick={() => { setEditValue(value); setSaveError(null); setIsEditing(true); }}
                title="Click to edit"
            >
                <Edit2 className="w-4 h-4" />
            </button>
        </div>
    );
}
