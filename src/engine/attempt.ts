import type { ExamDef, QuestionDef, Response } from './schema';

export type Status = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked';
export interface QuestionState { status: Status; response: Response | null; draft: Response | null; timeSpentMs: number; }
export interface AttemptState {
  examId: string; startedAt: number; endsAt: number; current: string;
  questions: Record<string, QuestionState>; submittedAt: number | null; enteredAt: number;
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
  return exam.sections.flatMap((section) => section.questions.map((question) => ({ ...question, sectionId: section.id, number: ++n })));
}

export function startAttempt(exam: ExamDef, now: number): AttemptState {
  const questions = flatQuestions(exam);
  const states = Object.fromEntries(questions.map((question, index) => [question.id, {
    status: index === 0 ? 'not-answered' : 'not-visited',
    response: null,
    draft: null,
    timeSpentMs: 0,
  } satisfies QuestionState]));
  return {
    examId: exam.id,
    startedAt: now,
    endsAt: now + exam.durationMinutes * 60_000,
    current: questions[0].id,
    questions: states,
    submittedAt: null,
    enteredAt: now,
  };
}

export const hasValue = (response: Response | null): response is Response =>
  response != null && (Array.isArray(response) ? response.length > 0 : typeof response === 'number' ? Number.isFinite(response) : response !== '');

export function hasValidAnswer(question: QuestionDef, response: Response | null): response is Response {
  if (question.type === 'numeric') return typeof response === 'number' && Number.isFinite(response);
  if (question.type === 'multiple') return Array.isArray(response) && response.length > 0;
  return typeof response === 'string' && response.length > 0;
}

export function reduce(exam: ExamDef, state: AttemptState, action: Action): AttemptState {
  if (state.submittedAt !== null) return state;

  const questions = flatQuestions(exam);
  const order = questions.map((question) => question.id);
  const currentState = state.questions[state.current];
  const currentQuestion = questions.find((question) => question.id === state.current);
  if (!currentState || !currentQuestion) return state;

  // A click that arrives after the deadline must not sneak in an answer or navigation.
  if (action.type !== 'submit' && 'now' in action && action.now >= state.endsAt) {
    return reduce(exam, state, { type: 'submit', now: state.endsAt });
  }

  const move = (source: AttemptState, id: string, now: number): AttemptState => {
    // Re-selecting the current question must preserve its unsaved draft.
    if (id === source.current) return source;
    const leaving = source.questions[source.current];
    const updatedQuestions = {
      ...source.questions,
      [source.current]: {
        ...leaving,
        timeSpentMs: leaving.timeSpentMs + Math.max(0, now - source.enteredAt),
        // CBT responses are committed by Save & Next; palette navigation discards edits.
        draft: leaving.response,
      },
    };
    const target = updatedQuestions[id];
    if (!target) return source;
    if (target.status === 'not-visited') updatedQuestions[id] = { ...target, status: 'not-answered' };
    return { ...source, questions: updatedQuestions, current: id, enteredAt: now };
  };

  const next = () => order[Math.min(order.length - 1, order.indexOf(state.current) + 1)];
  const withCurrent = (patch: Partial<QuestionState>) => ({
    ...state,
    questions: { ...state.questions, [state.current]: { ...currentState, ...patch } },
  });

  switch (action.type) {
    case 'goto':
      return order.includes(action.id) ? move(state, action.id, action.now) : state;

    case 'draft':
      return withCurrent({ draft: action.value });

    case 'save-next': {
      const answered = hasValidAnswer(currentQuestion, currentState.draft);
      return move(withCurrent({
        response: answered ? currentState.draft : null,
        status: answered ? 'answered' : 'not-answered',
      }), next(), action.now);
    }

    case 'save-mark-next': {
      const answered = hasValidAnswer(currentQuestion, currentState.draft);
      return move(withCurrent({
        response: answered ? currentState.draft : null,
        status: answered ? 'answered-marked' : 'marked',
      }), next(), action.now);
    }

    case 'mark-next':
      return move(withCurrent({
        status: hasValidAnswer(currentQuestion, currentState.response) ? 'answered-marked' : 'marked',
      }), next(), action.now);

    case 'clear':
      return withCurrent({ draft: null, response: null, status: 'not-answered' });

    case 'submit': {
      const submittedAt = Math.min(state.endsAt, Math.max(state.startedAt, action.now));
      const leaving = state.questions[state.current];
      return {
        ...state,
        submittedAt,
        questions: {
          ...state.questions,
          [state.current]: {
            ...leaving,
            timeSpentMs: leaving.timeSpentMs + Math.max(0, submittedAt - state.enteredAt),
          },
        },
      };
    }
  }
}

export function statusCounts(state: AttemptState, ids?: string[]): Record<Status, number> {
  const counts: Record<Status, number> = { 'not-visited': 0, 'not-answered': 0, answered: 0, marked: 0, 'answered-marked': 0 };
  for (const [id, question] of Object.entries(state.questions)) {
    if (!ids || ids.includes(id)) counts[question.status]++;
  }
  return counts;
}
