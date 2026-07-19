import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { HomeContent } from './supabase';

/**
 * Custom hook for loading and saving editable content from home_content table.
 * Replaces duplicate loadContent/saveContent/getContent patterns across components.
 */
export function useContent() {
    const [content, setContent] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    const loadContent = useCallback(async () => {
        const { data } = await supabase
            .from('home_content')
            .select('*');

        if (data) {
            const contentMap: Record<string, string> = {};
            data.forEach((item: HomeContent) => {
                contentMap[item.key] = item.value;
            });
            setContent(contentMap);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        // The request resolves before it updates local UI state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadContent();
    }, [loadContent]);

    const saveContent = useCallback(async (key: string, value: string) => {
        // Try to update first
        const { error: updateError, count } = await supabase
            .from('home_content')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', key);

        // If no rows updated (key doesn't exist), insert new row
        if (updateError || count === 0) {
            const { error: insertError } = await supabase
                .from('home_content')
                .upsert({ key, value, updated_at: new Date().toISOString() });

            if (insertError) {
                console.error('Error saving content:', insertError);
                throw insertError;
            }
        }

        setContent(prev => ({ ...prev, [key]: value }));
    }, []);

    const getContent = useCallback((key: string, fallback: string): string => {
        return content[key] || fallback;
    }, [content]);

    return { content, loading, saveContent, getContent, reloadContent: loadContent };
}
