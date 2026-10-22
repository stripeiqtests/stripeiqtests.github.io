import type { PublicQuestion } from './supabase';

export interface TestDraft {
  attemptId: string;
  fingerprint: string;
  answers: Record<string, string>;
  currentIndex: number;
  updatedAt: number;
}

const prefix = 'inner-code:draft:';
const maxAge = 7 * 24 * 60 * 60 * 1000;

// Includes displayed content so an old draft cannot silently answer changed questions.
export function questionFingerprint(questions: PublicQuestion[]): string {
  return JSON.stringify(questions.map(q => [q.id, q.question_text, q.options, q.image_url]));
}

export function readDraft(testId: string, fingerprint: string): TestDraft | null {
  try {
    const raw = localStorage.getItem(prefix + testId);
    if (!raw) return null;
    const draft = JSON.parse(raw) as TestDraft;
    if (draft.fingerprint !== fingerprint || Date.now() - draft.updatedAt > maxAge
      || !Number.isFinite(draft.updatedAt) || !Number.isInteger(draft.currentIndex)
      || draft.currentIndex < 0 || !draft.answers || typeof draft.answers !== 'object'
      || Array.isArray(draft.answers) || typeof draft.attemptId !== 'string') return null;
    return draft;
  } catch { return null; }
}

export function writeDraft(testId: string, draft: TestDraft): boolean {
  try { localStorage.setItem(prefix + testId, JSON.stringify(draft)); return true; }
  catch { return false; }
}

export function clearDraft(testId: string) {
  try { localStorage.removeItem(prefix + testId); } catch { /* Storage may be disabled. */ }
}
