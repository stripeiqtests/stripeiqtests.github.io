/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

export const defaultSupportContact = 'stripeiqtests@proton.me';

export function supportHref(contact: string): string | null {
  const value = contact.trim();
  if (/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(value)) return `mailto:${value}`;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

const SiteSettingsContext = createContext<{ supportContact: string; saveSupportContact: (contact: string) => Promise<void> }>({ supportContact: defaultSupportContact, saveSupportContact: async () => { throw new Error('Settings provider is unavailable'); } });

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [supportContact, setSupportContact] = useState(defaultSupportContact);
  const saveRevision = useRef(0);
  useEffect(() => {
    let active = true;
    const revisionAtStart = saveRevision.current;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    void Promise.resolve(supabase.from('app_settings').select('value').eq('key', 'support_contact')
      .retry(false).abortSignal(controller.signal).maybeSingle()).then(({ data }) => {
        if (active && revisionAtStart === saveRevision.current && data?.value && supportHref(data.value)) setSupportContact(data.value);
      }).catch(() => { /* Keep the current contact when the optional read fails. */ })
      .finally(() => clearTimeout(timeout));
    return () => { active = false;clearTimeout(timeout);controller.abort(); };
  }, []);
  async function saveSupportContact(contact: string) {
    const value = contact.trim();
    if (!supportHref(value)) throw new Error('Enter an email address or an HTTPS link.');
    const { error } = await supabase.from('app_settings').upsert({ key: 'support_contact', value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .abortSignal(AbortSignal.timeout(8000));
    if (error) throw error;
    ++saveRevision.current;
    setSupportContact(value);
  }
  return <SiteSettingsContext.Provider value={{ supportContact, saveSupportContact }}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() { return useContext(SiteSettingsContext); }
