import { describe, expect, it } from 'vitest';
import { JEE_QUESTION_BANK } from '../data/jee-question-bank';
import {
  createQuestionBankMock,
  filterBankQuestions,
  toggleVisibleSelection,
} from './question-bank';

const defaults = {
  search: '',
  subject: 'All' as const,
  topic: 'All',
  subtopic: 'All',
  difficulty: 'All' as const,
};

describe('JEE question bank filters', () => {
  it('filters independently by subject, topic, subtopic and difficulty', () => {
    const result = filterBankQuestions(JEE_QUESTION_BANK, {
      ...defaults,
      subject: 'Physics',
      topic: 'Current Electricity',
      subtopic: 'Series circuits',
      difficulty: 'Medium',
    });

    expect(result.map((entry) => entry.id)).toEqual(['phy-ele-004']);
  });

  it('searches question text, taxonomy, explanations and option text case-insensitively', () => {
    expect(filterBankQuestions(JEE_QUESTION_BANK, { ...defaults, search: 'NEWTON' }).map((q) => q.id))
      .toEqual(['phy-nlm-002']);
    expect(filterBankQuestions(JEE_QUESTION_BANK, { ...defaults, search: 'trigonal pyramidal' }).map((q) => q.id))
      .toEqual(['chem-bond-003']);
    expect(filterBankQuestions(JEE_QUESTION_BANK, { ...defaults, search: 'work-energy theorem' }).map((q) => q.id))
      .toEqual(['phy-wpe-003']);
  });

  it('returns all questions when no filters are active', () => {
    expect(filterBankQuestions(JEE_QUESTION_BANK, defaults)).toHaveLength(15);
  });
});

describe('visible question selection', () => {
  it('adds visible questions while preserving selections hidden by filters', () => {
    expect(toggleVisibleSelection(['hidden-question', 'phy-kin-001'], ['phy-kin-001', 'chem-mole-001']))
      .toEqual(['hidden-question', 'phy-kin-001', 'chem-mole-001']);
  });

  it('deselects only visible questions when all visible questions are selected', () => {
    expect(toggleVisibleSelection(['hidden-question', 'phy-kin-001', 'chem-mole-001'], ['phy-kin-001', 'chem-mole-001']))
      .toEqual(['hidden-question']);
  });

  it('leaves the selection unchanged when no questions are visible', () => {
    expect(toggleVisibleSelection(['hidden-question'], [])).toEqual(['hidden-question']);
  });
});

describe('question-bank mock assembly', () => {
  it('builds a schema-valid, sectioned mock with configured duration and negative marking', () => {
    const result = createQuestionBankMock(
      JEE_QUESTION_BANK,
      ['phy-kin-001', 'chem-mole-001', 'math-cal-001'],
      { examId: 'bank-mock-test', durationMinutes: 12, negativeMarks: 2 },
    );

    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.exam.durationMinutes).toBe(12);
    expect(result.exam.sections.map((section) => section.name)).toEqual(['Physics', 'Chemistry', 'Mathematics']);
    expect(result.exam.sections.map((section) => section.questions.length)).toEqual([1, 1, 1]);
    expect(result.exam.sections.every((section) => section.marking.correct === 4 && section.marking.incorrect === 2))
      .toBe(true);
  });

  it('rejects empty, duplicate and unknown selections', () => {
    const options = { examId: 'invalid-bank-mock', durationMinutes: 10, negativeMarks: 1 };
    expect(createQuestionBankMock(JEE_QUESTION_BANK, [], options).ok).toBe(false);
    expect(createQuestionBankMock(JEE_QUESTION_BANK, ['phy-kin-001', 'phy-kin-001'], options).ok).toBe(false);
    expect(createQuestionBankMock(JEE_QUESTION_BANK, ['missing-id'], options).ok).toBe(false);
  });

  it('rejects invalid mock duration through the production exam schema', () => {
    const result = createQuestionBankMock(
      JEE_QUESTION_BANK,
      ['phy-kin-001'],
      { examId: 'invalid-duration', durationMinutes: 0, negativeMarks: 1 },
    );
    expect(result.ok).toBe(false);
  });
});

describe('bundled question-bank metadata', () => {
  it('keeps metadata IDs aligned with unique exam question IDs', () => {
    const metadataIds = JEE_QUESTION_BANK.map((entry) => entry.id);
    const questionIds = JEE_QUESTION_BANK.map((entry) => entry.question.id);
    expect(new Set(metadataIds).size).toBe(metadataIds.length);
    expect(new Set(questionIds).size).toBe(questionIds.length);
    expect(questionIds).toEqual(metadataIds);
    expect(JEE_QUESTION_BANK.every((entry) => entry.topic.trim() && entry.subtopic.trim())).toBe(true);
  });
});
