import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabase';
import type { HomeContent } from './supabase';

/**
 * Custom hook for loading and saving editable content from home_content table.
 * Replaces duplicate loadContent/saveContent/getContent patterns across components.
 */
export function useContent() {
    const [content, setContent] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const loadSequence = useRef(0);
    const loadController = useRef<AbortController | null>(null);
    const saveRevision = useRef(0);
    const savedKeys = useRef(new Map<string, number>());
    const cancelLoad = useCallback(() => {
        ++loadSequence.current;
        loadController.current?.abort();
    }, []);

    const loadContent = useCallback(async () => {
        const sequence = ++loadSequence.current;
        const revisionAtStart = saveRevision.current;
        loadController.current?.abort();
        const controller = new AbortController();
        loadController.current = controller;
        const timeout = setTimeout(() => controller.abort(), 8000);
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('home_content')
                .select('key,value')
                .retry(false)
                .abortSignal(controller.signal);

            if (sequence !== loadSequence.current || error || !data) return;
            const contentMap: Record<string, string> = {};
            data.forEach((item: Pick<HomeContent, 'key' | 'value'>) => {
                contentMap[item.key] = item.value;
            });
            setContent(current => {
                // A read started before a successful write may return its old
                // snapshot afterwards. Keep those saved keys, but still load
                // unrelated server content from the same response.
                const merged = { ...contentMap };
                for (const [key, revision] of savedKeys.current) {
                    if (revision > revisionAtStart && key in current) merged[key] = current[key];
                }
                return merged;
            });
        } catch {
            // Preserve the existing content/defaults when the optional read fails.
        } finally {
            clearTimeout(timeout);
            if (sequence === loadSequence.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        // The request resolves before it updates local UI state.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void loadContent();
        return cancelLoad;
    }, [loadContent, cancelLoad]);

    const saveContent = useCallback(async (key: string, value: string) => {
        const { error } = await supabase.from('home_content')
            .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
            .abortSignal(AbortSignal.timeout(8000));
        if (error) throw error;

        savedKeys.current.set(key, ++saveRevision.current);
        setContent(prev => ({ ...prev, [key]: value }));
    }, []);

    const getContent = useCallback((key: string, fallback: string): string => {
        return content[key] ?? fallback;
    }, [content]);

    return { content, loading, saveContent, getContent, reloadContent: loadContent };
}
