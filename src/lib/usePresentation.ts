import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import {
  defaultPresentation,
  parsePresentation,
  type Presentation,
  validPresentation,
} from '../../supabase/functions/_shared/presentation.ts';

export function usePresentation() {
  const [presentation, setPresentation] = useState(defaultPresentation);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true);
    setError(false);
    try {
      const { data, error: readError } = await supabase.from('app_settings').select('value')
        .eq('key', 'result_presentation').retry(false).abortSignal(AbortSignal.timeout(8000))
        .maybeSingle();
      if (request !== generation.current) return;
      if (readError || (data && !validRaw(data.value))) {
        throw new Error('Unavailable presentation settings');
      }
      setPresentation(parsePresentation(data?.value));
    } catch {
      if (request === generation.current) setError(true);
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, []);
  const cancel = useCallback(() => {
    ++generation.current;
  }, []);
  useEffect(() => {
    // This asynchronous loader is shared by initial loading and explicit retries.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    return cancel;
  }, [reload, cancel]);
  async function save(value: Presentation) {
    if (loading || error || !validPresentation(value)) {
      throw new Error('Invalid presentation settings');
    }
    const { error: writeError } = await supabase.from('app_settings').upsert({
      key: 'result_presentation',
      value: JSON.stringify(value),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'key' })
      .abortSignal(AbortSignal.timeout(8000));
    if (writeError) throw writeError;
    setPresentation(structuredClone(value));
  }
  return { presentation, loading, error, reload, save };
}
function validRaw(raw: unknown) {
  try {
    return typeof raw === 'string' && validPresentation(JSON.parse(raw));
  } catch {
    return false;
  }
}
