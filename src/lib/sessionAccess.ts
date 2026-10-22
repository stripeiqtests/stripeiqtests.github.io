const storagePrefix = 'iq-test-session-access:';
const inMemory = new Map<string, string>();

function isUuid(value: string | null): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export function storeSessionAccess(sessionId: string, accessToken: string) {
  if (!isUuid(sessionId) || !isUuid(accessToken)) return false;
  inMemory.set(sessionId, accessToken);
  try { sessionStorage.setItem(`${storagePrefix}${sessionId}`, accessToken); return true; }
  catch { return false; }
}

export function readSessionAccess(sessionId: string): string | null {
  if (!isUuid(sessionId)) return null;

  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const fragmentToken = fragment.get('access_token');
  if (isUuid(fragmentToken)) {
    const stored = storeSessionAccess(sessionId, fragmentToken);
    if (stored) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    return fragmentToken;
  }

  try {
    const stored = sessionStorage.getItem(`${storagePrefix}${sessionId}`);
    return isUuid(stored) ? stored : inMemory.get(sessionId) ?? null;
  } catch { return inMemory.get(sessionId) ?? null; }
}

export function resultPath(sessionId: string, accessToken: string) {
  return `/results/${encodeURIComponent(sessionId)}#access_token=${encodeURIComponent(accessToken)}`;
}
