export type AnalyticsConsent = 'granted' | 'denied' | null;
const key = 'inner-code:analytics-consent:v2';
let memory: AnalyticsConsent = null;

export function readConsent(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(key);
    return value === 'granted' || value === 'denied' ? value : memory;
  } catch { return memory; }
}

export function setConsent(value: Exclude<AnalyticsConsent, null>) {
  memory = value;
  try { localStorage.setItem(key, value); } catch { /* Respect this tab's choice without storage. */ }
  window.dispatchEvent(new Event('inner-code:consent-changed'));
}

export function openConsentSettings() {
  window.dispatchEvent(new Event('inner-code:open-consent'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}
