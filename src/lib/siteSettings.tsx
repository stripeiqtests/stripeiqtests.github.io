/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
  useEffect(() => {
    let active = true;
    void supabase.from('app_settings').select('value').eq('key', 'support_contact').maybeSingle().then(({ data }) => {
      if (active && data?.value && supportHref(data.value)) setSupportContact(data.value);
    });
    return () => { active = false; };
  }, []);
  async function saveSupportContact(contact: string) {
    const value = contact.trim();
    if (!supportHref(value)) throw new Error('Enter an email address or an HTTPS link.');
    const { error } = await supabase.from('app_settings').upsert({ key: 'support_contact', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) throw error;
    setSupportContact(value);
  }
  return <SiteSettingsContext.Provider value={{ supportContact, saveSupportContact }}>{children}</SiteSettingsContext.Provider>;
}

export function useSiteSettings() { return useContext(SiteSettingsContext); }
