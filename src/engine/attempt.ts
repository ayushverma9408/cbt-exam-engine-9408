import type { ExamDef, QuestionDef, Response } from './schema';

/**
 * Attempt state as a pure reducer. Question statuses follow the standard
 * computer-based-test palette used by NTA/IBPS style exams.
 */

export type Status = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';

export interface QuestionState {
  status: Status;
  /** Saved response (only what the candidate explicitly saved counts). */
  response: Response | null;
  /** Unsaved selection in the UI. */
  draft: Response | null;
  timeSpentMs: number;
}

export interface AttemptState {
  examId: string;
  startedAt: number;
  /** Deadline in epoch ms; auto-submit when reached. */
  endsAt: number;
  current: string; // question id
  questions: Record<string, QuestionState>;
  submittedAt: number | null;
  /** When the current question was opened, for time tracking. */
  enteredAt: number;
}

export type Action =
  | { type: 'goto'; id: string; now: number }
  | { type: 'draft'; value: Response | null }
  | { type: 'save-next'; now: number }
  | { type: 'mark-next'; now: number }
  | { type: 'save-mark-next'; now: number }
  | { type: 'clear' }
  | { type: 'submit'; now: number };

export function flatQuestions(exam: ExamDef): (QuestionDef & { sectionId: string; number: number })[] {
  let n = 0;
  return exam.sections.flatMap((s) => s.questions.map((q) => ({ ...q, sectionId: s.id, number: ++n })));
}

export function startAttempt(exam: ExamDef, now: number): AttemptState {
  const qs = flatQuestions(exam);
  const questions = Object.fromEntries(
    qs.map((q, i) => [
      q.id,
      {
        status: i === 0 ? 'not-answered' : 'not-visited',
        response: null,
        draft: null,
        timeSpentMs: 0,
      } satisfies QuestionState,
    ]),
  );
  return {
    examId: exam.id,
    startedAt: now,
    endsAt: now + exam.durationMinutes * 60_000,
    current: qs[0].id,
    questions,
    submittedAt: null,
    enteredAt: now,
  };
}

export const hasValue = (r: Response | null): r is Response =>
  r != null && (Array.isArray(r) ? r.length > 0 : typeof r === 'number' ? Number.isFinite(r) : r !== '');

export function reduce(exam: ExamDef, state: AttemptState, action: Action): AttemptState {
  if (state.submittedAt) return state;
  const order = flatQuestions(exam).map((q) => q.id);
  const cur = state.questions[state.current];

  // Leave the current question: accrue time, then enter `id`.
  const move = (s: AttemptState, id: string, now: number): AttemptState => {
    const leaving = s.questions[s.current];
    const questions = {
      ...s.questions,
      [s.current]: {
        ...leaving,
        timeSpentMs: leaving.timeSpentMs + Math.max(0, now - s.enteredAt),
        draft: leaving.response,
      },
    };
    const target = questions[id];
    if (target.status === 'not-visited') questions[id] = { ...target, status: 'not-answered' };
    return { ...s, questions, current: id, enteredAt: now };
  };
  const next = () => order[Math.min(order.length - 1, order.indexOf(state.current) + 1)];
  const withCurrent = (patch: Partial<QuestionState>) => ({
    ...state,
    questions: { ...state.questions, [state.current]: { ...cur, ...patch } },
  });

  switch (action.type) {
    case 'goto':
      return order.includes(action.id) ? move(state, action.id, action.now) : state;

    case 'draft':
      return withCurrent({ draft: action.value });

    case 'save-next': {
      const answered = hasValue(cur.draft);
      return move(
        withCurrent({ response: answered ? cur.draft : null, status: answered ? 'answered' : 'not-answered' }),
        next(),
        action.now,
      );
    }

    case 'save-mark-next': {
      const answered = hasValue(cur.draft);
      return move(
        withCurrent({ response: answered ? cur.draft : null, status: answered ? 'answered-marked' : 'marked' }),
        next(),
        action.now,
      );
    }

    case 'mark-next':
      // Marks for review without changing the saved response.
      return move(withCurrent({ status: hasValue(cur.response) ? 'answered-marked' : 'marked' }), next(), action.now);

    case 'clear':
      return withCurrent({ draft: null, response: null, status: 'not-answered' });

    case 'submit': {
      const leaving = state.questions[state.current];
      return {
        ...state,
        submittedAt: action.now,
        questions: {
          ...state.questions,
          [state.current]: { ...leaving, timeSpentMs: leaving.timeSpentMs + Math.max(0, action.now - state.enteredAt) },
        },
      };
    }
  }
}

export function statusCounts(state: AttemptState, ids?: string[]): Record<Status, number> {
  const out: Record<Status, number> = {
    'not-visited': 0,
    'not-answered': 0,
    answered: 0,
    marked: 0,
    'answered-marked': 0,
  };
  for (const [id, q] of Object.entries(state.questions)) if (!ids || ids.includes(id)) out[q.status]++;
  return out;
}
