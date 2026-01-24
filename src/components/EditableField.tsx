import { useState, useRef, useEffect } from 'react';
import { Edit2, Check, X } from 'lucide-react';
import { useAdmin } from '../lib/AdminContext';

interface EditableFieldProps {
    value: string;
    onSave: (value: string) => Promise<void>;
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'span';
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
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [isSaving, setIsSaving] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    useEffect(() => {
        setEditValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = async () => {
        if (editValue === value) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(editValue);
            setIsEditing(false);
        } catch (error) {
            console.error('Failed to save:', error);
            setEditValue(value);
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setEditValue(value);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
            handleSave();
        }
        if (e.key === 'Escape') {
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
            <div className="relative inline-block w-full">
                {multiline ? (
                    <textarea
                        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={inputClasses}
                        rows={3}
                        disabled={isSaving}
                    />
                ) : (
                    <input
                        ref={inputRef as React.RefObject<HTMLInputElement>}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className={inputClasses}
                        disabled={isSaving}
                    />
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                    <button
                        onClick={handleCancel}
                        className="p-1 text-gray-400 hover:text-red-500 rounded"
                        disabled={isSaving}
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleSave}
                        className="p-1 text-gray-400 hover:text-green-500 rounded"
                        disabled={isSaving}
                    >
                        <Check className="w-4 h-4" />
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
            onClick={() => setIsEditing(true)}
        >
            <Component className={`${className} ${isHovered ? 'bg-indigo-50 rounded' : ''}`}>
                {value}
            </Component>
            <button
                className={`p-2 rounded-lg border-2 transition-all cursor-pointer ${isHovered
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
                    : 'bg-transparent text-indigo-500 border-indigo-300 hover:border-indigo-500'
                    }`}
                onClick={() => setIsEditing(true)}
                title="Click to edit"
            >
                <Edit2 className="w-4 h-4" />
            </button>
        </div>
    );
}
