import { z } from 'zod';

/**
 * Exam definition format. Authors write JSON in this shape; it is validated
 * with Zod on import so a malformed file can never crash the exam UI.
 */

const Marking = z.object({
  correct: z.number().positive(),
  /** Marks deducted for a wrong answer (a positive number, e.g. 1 for −1). */
  incorrect: z.number().min(0).default(0),
  /**
   * Multi-correct only: award `correct / n` per right option chosen when no
   * wrong option is chosen (JEE Advanced style). Otherwise all-or-nothing.
   */
  partial: z.boolean().default(false),
});

const Base = z.object({
  id: z.string().trim().min(1),
  text: z.string().trim().min(1),
  /** Optional worked solution shown in review mode. */
  solution: z.string().optional(),
  /** Overrides the section's marking scheme for this question. */
  marking: Marking.optional(),
});

const Option = z.object({ id: z.string().trim().min(1), text: z.string().min(1) });

const Options = z.array(Option).min(2).max(6).superRefine((options, ctx) => {
  const ids = new Set<string>();
  options.forEach((option, index) => {
    if (ids.has(option.id)) {
      ctx.addIssue({
        code: 'custom',
        message: `Duplicate option id "${option.id}"`,
        path: [index, 'id'],
      });
    }
    ids.add(option.id);
  });
});

export const SingleQuestion = Base.extend({
  type: z.literal('single'),
  options: Options,
  answer: z.string().min(1),
});

export const MultipleQuestion = Base.extend({
  type: z.literal('multiple'),
  options: Options,
  answer: z.array(z.string().min(1)).min(1),
});

export const NumericQuestion = Base.extend({
  type: z.literal('numeric'),
  answer: z.number().finite(),
  /** Absolute tolerance for accepting an answer, e.g. 0.01. */
  tolerance: z.number().finite().min(0).default(0),
});

export const Question = z.discriminatedUnion('type', [SingleQuestion, MultipleQuestion, NumericQuestion]);

export const Section = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  marking: Marking,
  questions: z.array(Question).min(1),
});

export const Exam = z
  .object({
    id: z.string().trim().min(1),
    title: z.string().trim().min(1),
    description: z.string().optional(),
    durationMinutes: z.number().finite().positive().max(600),
    instructions: z.array(z.string()).default([]),
    sections: z.array(Section).min(1),
  })
  .superRefine((exam, ctx) => {
    const sectionIds = new Set<string>();
    const questionIds = new Set<string>();

    exam.sections.forEach((section, sectionIndex) => {
      if (sectionIds.has(section.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `Duplicate section id "${section.id}"`,
          path: ['sections', sectionIndex, 'id'],
        });
      }
      sectionIds.add(section.id);

      section.questions.forEach((question, questionIndex) => {
        const path = ['sections', sectionIndex, 'questions', questionIndex];
        if (questionIds.has(question.id)) {
          ctx.addIssue({
            code: 'custom',
            message: `Duplicate question id "${question.id}"`,
            path: [...path, 'id'],
          });
        }
        questionIds.add(question.id);

        if (question.type === 'single' && !question.options.some((option) => option.id === question.answer)) {
          ctx.addIssue({
            code: 'custom',
            message: `Answer "${question.answer}" is not one of the options`,
            path: [...path, 'answer'],
          });
        }

        if (question.type === 'multiple') {
          const optionIds = new Set(question.options.map((option) => option.id));
          const answers = new Set<string>();
          for (const answer of question.answer) {
            if (!optionIds.has(answer)) {
              ctx.addIssue({
                code: 'custom',
                message: `Answer "${answer}" is not one of the options`,
                path: [...path, 'answer'],
              });
            }
            if (answers.has(answer)) {
              ctx.addIssue({
                code: 'custom',
                message: `Duplicate correct answer "${answer}"`,
                path: [...path, 'answer'],
              });
            }
            answers.add(answer);
          }
        }
      });
    });
  });

export type ExamDef = z.infer<typeof Exam>;
export type SectionDef = z.infer<typeof Section>;
export type QuestionDef = z.infer<typeof Question>;
export type MarkingDef = z.infer<typeof Marking>;

/** A candidate's response: option id(s) or a number. */
export type Response = string | string[] | number;

export function parseExam(json: unknown): { ok: true; exam: ExamDef } | { ok: false; errors: string[] } {
  const result = Exam.safeParse(json);
  if (result.success) return { ok: true, exam: result.data };
  return { ok: false, errors: result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`) };
}
