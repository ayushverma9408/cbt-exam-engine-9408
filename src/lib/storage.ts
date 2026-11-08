import type { AttemptState, QuestionState, Status } from '../engine/attempt';
import { Exam, parseExam, type ExamDef } from '../engine/schema';

const KEY = 'cbt-exam-engine/v1';
export interface Saved { exam: ExamDef; attempt: AttemptState; }
const STATUSES: Status[] = ['not-visited', 'not-answered', 'answered', 'marked', 'answered-marked'];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function parseAttempt(value: unknown, exam: ExamDef): AttemptState | null {
  if (!isRecord(value)) return null;
  const { examId, startedAt, endsAt, current, questions, submittedAt, enteredAt } = value;
  const expectedEnd = typeof startedAt === 'number' ? startedAt + exam.durationMinutes * 60_000 : NaN;
  if (examId !== exam.id || typeof startedAt !== 'number' || !Number.isFinite(startedAt) ||
      typeof endsAt !== 'number' || !Number.isFinite(endsAt) || endsAt !== expectedEnd ||
      typeof enteredAt !== 'number' || !Number.isFinite(enteredAt) || enteredAt < startedAt || enteredAt > endsAt ||
      (submittedAt !== null && (typeof submittedAt !== 'number' || !Number.isFinite(submittedAt) || submittedAt < startedAt || submittedAt > endsAt)) ||
      typeof current !== 'string' || !isRecord(questions)) return null;

  const definitions = new Map(exam.sections.flatMap((section) => section.questions.map((question) => [question.id, question] as const)));
  const ids = [...definitions.keys()];
  if (!ids.includes(current) || ids.length !== Object.keys(questions).length) return null;

  const isStoredValue = (value: unknown, question: (typeof exam.sections)[number]['questions'][number], draft: boolean) => {
    if (value === null) return true;
    if (question.type === 'numeric') {
      if (typeof value === 'number') return Number.isFinite(value);
      return draft && typeof value === 'string' && /^-?$|^-?(?:\\d+\\.?\\d*|\\.\\d*)$/.test(value);
    }
    const optionIds = new Set(question.options.map((option) => option.id));
    if (question.type === 'single') return typeof value === 'string' && optionIds.has(value);
    return Array.isArray(value) && value.every((item) => typeof item === 'string' && optionIds.has(item)) &&
      new Set(value).size === value.length;
  };

  const parsed: Record<string, QuestionState> = {};
  let totalTimeSpent = 0;
  for (const id of ids) {
    const saved = questions[id];
    const definition = definitions.get(id)!;
    if (!isRecord(saved) || !STATUSES.includes(saved.status as Status) ||
        typeof saved.timeSpentMs !== 'number' || !Number.isFinite(saved.timeSpentMs) || saved.timeSpentMs < 0 ||
        saved.timeSpentMs > exam.durationMinutes * 60_000 ||
        !isStoredValue(saved.response, definition, false) || !isStoredValue(saved.draft, definition, true)) return null;

    const responsePresent = saved.response !== null &&
      !(Array.isArray(saved.response) && saved.response.length === 0) && saved.response !== '';
    if ((saved.status === 'answered' || saved.status === 'answered-marked') !== responsePresent) return null;
    if ((saved.status === 'not-visited' || saved.status === 'not-answered' || saved.status === 'marked') && responsePresent) return null;

    totalTimeSpent += saved.timeSpentMs;
    parsed[id] = saved as unknown as QuestionState;
  }
  if (totalTimeSpent > exam.durationMinutes * 60_000) return null;
  return { examId, startedAt, endsAt, current, questions: parsed, submittedAt, enteredAt };
}
function parseSaved(value: unknown): Saved | null {
  if (!isRecord(value)) return null;
  const parsedExam = Exam.safeParse(value.exam);
  if (!parsedExam.success) return null;
  const attempt = parseAttempt(value.attempt, parsedExam.data);
  return attempt ? { exam: parsedExam.data, attempt } : null;
}
export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = parseSaved(JSON.parse(raw));
    if (!saved) localStorage.removeItem(KEY);
    return saved;
  } catch { return null; }
}
export function save(value: Saved | null) {
  try {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable: the exam still works, it just can't resume */ }
}
const IMPORTED = 'cbt-exam-engine/imported';
export function loadImported(): ExamDef[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(IMPORTED) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => { const result = parseExam(item); return result.ok ? [result.exam] : []; });
  } catch { return []; }
}
export function saveImported(exams: ExamDef[]) {
  try { localStorage.setItem(IMPORTED, JSON.stringify(exams)); } catch { /* ignore */ }
}