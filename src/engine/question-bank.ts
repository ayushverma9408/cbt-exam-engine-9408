import type { BankQuestion, Difficulty, Subject } from '../data/jee-question-bank';
import { parseExam } from './schema';

export interface BankFilters {
  search: string;
  subject: 'All' | Subject;
  topic: string;
  subtopic: string;
  difficulty: 'All' | Difficulty;
}

export interface BankMockOptions {
  durationMinutes: number;
  negativeMarks: number;
  examId?: string;
}

export function filterBankQuestions(
  entries: readonly BankQuestion[],
  filters: BankFilters,
): BankQuestion[] {
  const needle = filters.search.trim().toLowerCase();

  return entries.filter((entry) => {
    const matchesSubject = filters.subject === 'All' || entry.subject === filters.subject;
    const matchesTopic = filters.topic === 'All' || entry.topic === filters.topic;
    const matchesSubtopic = filters.subtopic === 'All' || entry.subtopic === filters.subtopic;
    const matchesDifficulty = filters.difficulty === 'All' || entry.difficulty === filters.difficulty;
    if (!matchesSubject || !matchesTopic || !matchesSubtopic || !matchesDifficulty) return false;

    const optionText = 'options' in entry.question
      ? entry.question.options.map((option) => option.text).join(' ')
      : '';
    const searchableText = [
      entry.id,
      entry.subject,
      entry.topic,
      entry.subtopic,
      entry.difficulty,
      entry.question.text,
      entry.question.solution ?? '',
      optionText,
    ].join(' ').toLowerCase();

    return !needle || searchableText.includes(needle);
  });
}

/**
 * Select all visible questions without discarding selections hidden by the
 * current filters. If every visible question is already selected, deselect
 * only those visible questions instead.
 */
export function toggleVisibleSelection(selectedIds: readonly string[], visibleIds: readonly string[]): string[] {
  if (visibleIds.length === 0) return [...selectedIds];

  const selected = new Set(selectedIds);
  const visible = new Set(visibleIds);
  const allVisibleSelected = visibleIds.every((id) => selected.has(id));

  if (allVisibleSelected) return selectedIds.filter((id) => !visible.has(id));
  return [...selectedIds, ...visibleIds.filter((id) => !selected.has(id))];
}

export function createQuestionBankMock(
  entries: readonly BankQuestion[],
  selectedIds: readonly string[],
  options: BankMockOptions,
) {
  if (selectedIds.length === 0) {
    return { ok: false as const, errors: ['Select at least one question to create a mock test.'] };
  }

  const selected = new Set(selectedIds);
  if (selected.size !== selectedIds.length) {
    return { ok: false as const, errors: ['A question can only be selected once.'] };
  }

  const knownIds = new Set(entries.map((entry) => entry.id));
  const unknownIds = selectedIds.filter((id) => !knownIds.has(id));
  if (unknownIds.length > 0) {
    return { ok: false as const, errors: ['Unknown question ID(s): ' + unknownIds.join(', ')] };
  }

  const chosen = entries.filter((entry) => selected.has(entry.id));
  const sections = (['Physics', 'Chemistry', 'Mathematics'] as Subject[])
    .map((name) => ({
      id: name.toLowerCase(),
      name,
      marking: { correct: 4, incorrect: options.negativeMarks, partial: false },
      questions: chosen.filter((entry) => entry.subject === name).map((entry) => entry.question),
    }))
    .filter((section) => section.questions.length > 0);

  return parseExam({
    id: options.examId ?? 'jee-bank-' + Date.now(),
    title: 'JEE Main — Custom Question Bank Mock',
    description: 'A custom mock assembled from ' + chosen.length + ' curated practice questions.',
    durationMinutes: options.durationMinutes,
    instructions: [
      'This mock was assembled from the built-in original JEE practice question bank.',
      'Each single-correct, multiple-correct and numerical question is evaluated by the exam engine.',
      'Each correct answer awards 4 marks; the selected negative-marking value applies to an incorrect answer.',
      'Review the question carefully and save your response before moving on.',
    ],
    sections,
  });
}
