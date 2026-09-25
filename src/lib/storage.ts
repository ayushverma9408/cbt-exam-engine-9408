import type { AttemptState } from '../engine/attempt';
import type { ExamDef } from '../engine/schema';

/**
 * Attempts are saved on every change so a refresh or crash never loses work.
 * The timer is derived from `endsAt`, so reloading doesn't give extra time.
 */

const KEY = 'cbt-exam-engine/v1';

export interface Saved {
  exam: ExamDef;
  attempt: AttemptState;
}

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function save(value: Saved | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: the exam still works, it just can't resume */
  }
}

const IMPORTED = 'cbt-exam-engine/imported';

export function loadImported(): ExamDef[] {
  try {
    return JSON.parse(localStorage.getItem(IMPORTED) ?? '[]') as ExamDef[];
  } catch {
    return [];
  }
}

export function saveImported(exams: ExamDef[]) {
  try {
    localStorage.setItem(IMPORTED, JSON.stringify(exams));
  } catch {
    /* ignore */
  }
}
