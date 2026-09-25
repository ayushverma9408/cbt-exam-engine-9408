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
  id: z.string().min(1),
  text: z.string().min(1),
  /** Optional worked solution shown in review mode. */
  solution: z.string().optional(),
  /** Overrides the section's marking scheme for this question. */
  marking: Marking.optional(),
});

const Option = z.object({ id: z.string().min(1), text: z.string().min(1) });

export const SingleQuestion = Base.extend({
  type: z.literal('single'),
  options: z.array(Option).min(2).max(6),
  answer: z.string(),
});

export const MultipleQuestion = Base.extend({
  type: z.literal('multiple'),
  options: z.array(Option).min(2).max(6),
  answer: z.array(z.string()).min(1),
});

export const NumericQuestion = Base.extend({
  type: z.literal('numeric'),
  answer: z.number(),
  /** Absolute tolerance for accepting an answer, e.g. 0.01. */
  tolerance: z.number().min(0).default(0),
});

export const Question = z.discriminatedUnion('type', [SingleQuestion, MultipleQuestion, NumericQuestion]);

export const Section = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  marking: Marking,
  questions: z.array(Question).min(1),
});

export const Exam = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    durationMinutes: z.number().positive().max(600),
    instructions: z.array(z.string()).default([]),
    sections: z.array(Section).min(1),
  })
  .superRefine((exam, ctx) => {
    const ids = new Set<string>();
    exam.sections.forEach((s, si) =>
      s.questions.forEach((q, qi) => {
        const path = ['sections', si, 'questions', qi];
        if (ids.has(q.id))
          ctx.addIssue({ code: 'custom', message: `Duplicate question id "${q.id}"`, path: [...path, 'id'] });
        ids.add(q.id);
        if (q.type === 'single' && !q.options.some((o) => o.id === q.answer))
          ctx.addIssue({
            code: 'custom',
            message: `Answer "${q.answer}" is not one of the options`,
            path: [...path, 'answer'],
          });
        if (q.type === 'multiple') {
          const optionIds = new Set(q.options.map((o) => o.id));
          for (const a of q.answer)
            if (!optionIds.has(a))
              ctx.addIssue({
                code: 'custom',
                message: `Answer "${a}" is not one of the options`,
                path: [...path, 'answer'],
              });
        }
      }),
    );
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
  return { ok: false, errors: result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
}
