import { z } from 'zod';
import { parseExam, Question, type QuestionDef } from '../engine/schema';

export type Subject = 'Physics' | 'Chemistry' | 'Mathematics';
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface BankQuestion {
  id: string;
  subject: Subject;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  question: QuestionDef;
}

// Original practice questions written for this project; not copied from past papers.
const entries: BankQuestion[] = [
  {
    id: 'phy-kin-001', subject: 'Physics', topic: 'Kinematics', subtopic: 'Uniform acceleration', difficulty: 'Easy',
    question: { id: 'phy-kin-001', type: 'numeric', text: 'A body starts from rest and moves with constant acceleration 2 m/s². What distance (in metres) does it cover in 5 seconds?', answer: 25, tolerance: 0, solution: 'Using s = ut + ½at², s = 0 + ½ × 2 × 25 = 25 m.' },
  },
  {
    id: 'phy-nlm-002', subject: 'Physics', topic: 'Laws of Motion', subtopic: 'Newton’s second law', difficulty: 'Easy',
    question: { id: 'phy-nlm-002', type: 'single', text: 'A net force of 12 N acts on a 3 kg block on a frictionless horizontal surface. Its acceleration is:', options: [{ id: 'a', text: '2 m/s²' }, { id: 'b', text: '4 m/s²' }, { id: 'c', text: '9 m/s²' }, { id: 'd', text: '36 m/s²' }], answer: 'b', solution: 'Newton’s second law gives a = F/m = 12/3 = 4 m/s².' },
  },
  {
    id: 'phy-wpe-003', subject: 'Physics', topic: 'Work, Energy & Power', subtopic: 'Work-energy theorem', difficulty: 'Medium',
    question: { id: 'phy-wpe-003', type: 'numeric', text: 'A 2 kg object initially at rest receives 18 J of net work. Find its final speed in m/s.', answer: 3 * Math.sqrt(2), tolerance: 0.01, solution: 'W = ΔK = ½mv². Thus 18 = v², so v = √18 = 3√2 m/s.' },
  },
  {
    id: 'phy-ele-004', subject: 'Physics', topic: 'Current Electricity', subtopic: 'Series circuits', difficulty: 'Medium',
    question: { id: 'phy-ele-004', type: 'single', text: 'Two resistors of 4 Ω and 6 Ω are connected in series across an ideal 20 V source. The current is:', options: [{ id: 'a', text: '1 A' }, { id: 'b', text: '2 A' }, { id: 'c', text: '5 A' }, { id: 'd', text: '10 A' }], answer: 'b', solution: 'The equivalent resistance is 4 + 6 = 10 Ω. Ohm’s law gives I = 20/10 = 2 A.' },
  },
  {
    id: 'chem-mole-001', subject: 'Chemistry', topic: 'Some Basic Concepts', subtopic: 'Mole concept', difficulty: 'Easy',
    question: { id: 'chem-mole-001', type: 'numeric', text: 'How many moles are present in 18 g of water? (Molar mass of H₂O = 18 g mol⁻¹.)', answer: 1, tolerance: 0, solution: 'Number of moles = given mass / molar mass = 18/18 = 1 mol.' },
  },
  {
    id: 'chem-atom-002', subject: 'Chemistry', topic: 'Atomic Structure', subtopic: 'Quantum numbers', difficulty: 'Medium',
    question: { id: 'chem-atom-002', type: 'single', text: 'The maximum number of electrons that can occupy a subshell with azimuthal quantum number l = 2 is:', options: [{ id: 'a', text: '2' }, { id: 'b', text: '6' }, { id: 'c', text: '10' }, { id: 'd', text: '14' }], answer: 'c', solution: 'A subshell has 2l + 1 orbitals, each holding 2 electrons. For l = 2, capacity = 2(5) = 10.' },
  },
  {
    id: 'chem-bond-003', subject: 'Chemistry', topic: 'Chemical Bonding', subtopic: 'Molecular shape', difficulty: 'Easy',
    question: { id: 'chem-bond-003', type: 'single', text: 'According to VSEPR theory, the molecular shape of NH₃ is:', options: [{ id: 'a', text: 'Trigonal planar' }, { id: 'b', text: 'Trigonal pyramidal' }, { id: 'c', text: 'Tetrahedral' }, { id: 'd', text: 'Linear' }], answer: 'b', solution: 'Nitrogen has three bond pairs and one lone pair. The electron geometry is tetrahedral and the molecular shape is trigonal pyramidal.' },
  },
  {
    id: 'chem-org-004', subject: 'Chemistry', topic: 'Organic Chemistry', subtopic: 'Hydrocarbons', difficulty: 'Medium',
    question: { id: 'chem-org-004', type: 'multiple', text: 'Which of the following are saturated hydrocarbons?', options: [{ id: 'a', text: 'Methane' }, { id: 'b', text: 'Ethene' }, { id: 'c', text: 'Propane' }, { id: 'd', text: 'Ethyne' }], answer: ['a', 'c'], solution: 'Alkanes contain only carbon–carbon single bonds. Methane and propane are alkanes; ethene and ethyne are unsaturated.' },
  },
  {
    id: 'math-cal-001', subject: 'Mathematics', topic: 'Limits & Derivatives', subtopic: 'Basic differentiation', difficulty: 'Easy',
    question: { id: 'math-cal-001', type: 'single', text: 'For f(x) = 3x² − 5x + 2, the value of f′(2) is:', options: [{ id: 'a', text: '5' }, { id: 'b', text: '7' }, { id: 'c', text: '9' }, { id: 'd', text: '12' }], answer: 'b', solution: 'f′(x) = 6x − 5, so f′(2) = 12 − 5 = 7.' },
  },
  {
    id: 'math-mat-002', subject: 'Mathematics', topic: 'Matrices & Determinants', subtopic: 'Determinant of 2×2 matrix', difficulty: 'Easy',
    question: { id: 'math-mat-002', type: 'numeric', text: 'Find the determinant of the matrix [[3, 2], [1, 4]].', answer: 10, tolerance: 0, solution: 'For [[a,b],[c,d]], determinant = ad − bc = 3×4 − 2×1 = 10.' },
  },
  {
    id: 'math-pro-003', subject: 'Mathematics', topic: 'Probability', subtopic: 'Independent events', difficulty: 'Medium',
    question: { id: 'math-pro-003', type: 'numeric', text: 'A fair coin is tossed twice. What is the probability, expressed as a percentage, of getting exactly one head?', answer: 50, tolerance: 0, solution: 'The equally likely outcomes are HH, HT, TH, TT. Two of four have exactly one head, so the probability is 1/2 = 50%.' },
  },
  {
    id: 'math-vec-004', subject: 'Mathematics', topic: 'Vector Algebra', subtopic: 'Dot product', difficulty: 'Medium',
    question: { id: 'math-vec-004', type: 'numeric', text: 'For vectors a = 2i + 3j and b = i − 2j, calculate a · b.', answer: -4, tolerance: 0, solution: 'The dot product is 2×1 + 3×(−2) = 2 − 6 = −4.' },
  },
  {
    id: 'phy-elec-005', subject: 'Physics', topic: 'Electrostatics', subtopic: 'Electric field due to point charges', difficulty: 'Hard',
    question: { id: 'phy-elec-005', type: 'numeric', text: 'Two positive point charges +q and +4q are separated by distance d. At what fraction of d, measured from +q along the line joining them, is the net electric field zero?', answer: 1 / 3, tolerance: 0.001, solution: 'Between the charges, set q/x² = 4q/(d−x)². Taking positive roots gives d−x = 2x, hence x/d = 1/3.' },
  },
  {
    id: 'chem-eq-005', subject: 'Chemistry', topic: 'Chemical Equilibrium', subtopic: 'Equilibrium composition', difficulty: 'Hard',
    question: { id: 'chem-eq-005', type: 'numeric', text: 'For A ⇌ B, Kc = 4.0 at a fixed temperature. Initially [A] = 1.0 mol L⁻¹ and [B] = 0. Find the equilibrium concentration of B in mol L⁻¹.', answer: 0.8, tolerance: 0.001, solution: 'Let x be the amount converted. Then Kc = x/(1−x) = 4, so 5x = 4 and x = 0.8 mol L⁻¹.' },
  },
  {
    id: 'math-cal-005', subject: 'Mathematics', topic: 'Integral Calculus', subtopic: 'Definite integrals', difficulty: 'Hard',
    question: { id: 'math-cal-005', type: 'numeric', text: 'Evaluate the definite integral ∫₀¹ [2x/(1+x²)] dx. Give the value correct to three decimal places.', answer: 0.69314718056, tolerance: 0.001, solution: 'An antiderivative is ln(1+x²). Evaluating from 0 to 1 gives ln 2 ≈ 0.693.' },
  },
];

const BankEntry = z.object({
  id: z.string().trim().min(1),
  subject: z.enum(['Physics', 'Chemistry', 'Mathematics']),
  topic: z.string().trim().min(1),
  subtopic: z.string().trim().min(1),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']),
  question: Question,
}).superRefine((entry, ctx) => {
  if (entry.id !== entry.question.id) {
    ctx.addIssue({
      code: 'custom',
      message: 'Bank metadata ID must match the exam question ID.',
      path: ['question', 'id'],
    });
  }
});

const metadataValidation = z.array(BankEntry).superRefine((bank, ctx) => {
  const ids = new Set<string>();
  bank.forEach((entry, index) => {
    if (ids.has(entry.id)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Duplicate question-bank ID "' + entry.id + '".',
        path: [index, 'id'],
      });
    }
    ids.add(entry.id);
  });
}).safeParse(entries);

if (!metadataValidation.success) {
  const errors = metadataValidation.error.issues.map((issue) => issue.path.join('.') + ': ' + issue.message);
  throw new Error('Invalid JEE question-bank metadata: ' + errors.join('; '));
}

// Validate the complete bundled bank through the same exam schema used by imports.
const validatedEntries = metadataValidation.data;
const validation = parseExam({
  id: 'jee-bank-validation',
  title: 'JEE question bank validation',
  durationMinutes: 30,
  sections: (['Physics', 'Chemistry', 'Mathematics'] as Subject[]).map((subject) => ({
    id: subject.toLowerCase(),
    name: subject,
    marking: { correct: 4, incorrect: 1, partial: false },
    questions: validatedEntries.filter((entry) => entry.subject === subject).map((entry) => entry.question),
  })),
});
if (!validation.ok) throw new Error('Invalid bundled JEE question bank: ' + validation.errors.join('; '));

export const JEE_QUESTION_BANK: BankQuestion[] = validatedEntries;
