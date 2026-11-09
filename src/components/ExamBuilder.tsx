import { useMemo, useState } from 'react';
import { parseExam, type ExamDef, type QuestionDef } from '../engine/schema';
import { btn } from './ExamRoom';

type DraftQuestion = {
  type: 'single' | 'multiple' | 'numeric';
  text: string;
  options: string;
  answer: string;
  solution: string;
};

const emptyQuestion = (): DraftQuestion => ({
  type: 'single',
  text: '',
  options: 'Option A\nOption B\nOption C\nOption D',
  answer: 'a',
  solution: '',
});

export function ExamBuilder({
  onSave,
  onCancel,
}: {
  onSave: (exam: ExamDef) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('JEE Main Practice Test');
  const [description, setDescription] = useState('Custom JEE practice paper');
  const [duration, setDuration] = useState('180');
  const [subject, setSubject] = useState('Mixed');
  const [questions, setQuestions] = useState<DraftQuestion[]>([emptyQuestion()]);
  const [errors, setErrors] = useState<string[]>([]);

  const preview = useMemo(() => questions.filter((q) => q.text.trim()).length, [questions]);

  const updateQuestion = (index: number, patch: Partial<DraftQuestion>) => {
    setQuestions((current) => current.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const addQuestion = () => setQuestions((current) => [...current, emptyQuestion()]);
  const removeQuestion = (index: number) =>
    setQuestions((current) => current.length > 1 ? current.filter((_, i) => i !== index) : current);

  const save = () => {
    const sectionQuestions: QuestionDef[] = [];
    const issues: string[] = [];

    questions.forEach((q, index) => {
      const number = index + 1;
      if (!q.text.trim()) {
        issues.push(`Question ${number}: enter the question statement.`);
        return;
      }
      if (q.type === 'numeric') {
        const answer = Number(q.answer);
        if (!q.answer.trim() || !Number.isFinite(answer)) {
          issues.push(`Question ${number}: enter a valid numeric answer.`);
          return;
        }
        sectionQuestions.push({
          id: `q${number}`,
          type: 'numeric',
          text: q.text.trim(),
          answer,
          tolerance: 0,
          ...(q.solution.trim() ? { solution: q.solution.trim() } : {}),
        });
        return;
      }

      const optionTexts = q.options.split('\n').map((s) => s.trim()).filter(Boolean);
      if (optionTexts.length < 2 || optionTexts.length > 6) {
        issues.push(`Question ${number}: add between 2 and 6 options, one per line.`);
        return;
      }
      const options = optionTexts.map((text, i) => ({ id: String.fromCharCode(97 + i), text }));
      const answers = q.answer.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      if (!answers.length || answers.some((a) => !options.some((o) => o.id === a))) {
        issues.push(`Question ${number}: answer must use option IDs a–f from the options shown.`);
        return;
      }
      if (q.type === 'single' && answers.length !== 1) {
        issues.push(`Question ${number}: single-correct questions need exactly one answer ID.`);
        return;
      }
      sectionQuestions.push({
        id: `q${number}`,
        type: q.type,
        text: q.text.trim(),
        options,
        answer: q.type === 'single' ? answers[0] : answers,
        ...(q.solution.trim() ? { solution: q.solution.trim() } : {}),
      } as QuestionDef);
    });

    if (!title.trim()) issues.push('Enter a test title.');
    const minutes = Number(duration);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 600) {
      issues.push('Duration must be between 1 and 600 minutes.');
    }
    if (issues.length) {
      setErrors(issues);
      return;
    }

    const candidate = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      durationMinutes: minutes,
      instructions: [
        'Read each question carefully before answering.',
        'Single-correct and multiple-correct questions use the displayed answer options.',
        'Numeric answers are evaluated using exact matching.',
      ],
      sections: [{
        id: 'section-1',
        name: subject.trim() || 'General',
        marking: { correct: 4, incorrect: 1, partial: false },
        questions: sectionQuestions,
      }],
    };
    const parsed = parseExam(candidate);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    onSave(parsed.exam);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">← Back to tests</button>
      <div className="mt-4 rounded-2xl border border-line bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand">JEE paper studio</p>
            <h1 className="mt-1 text-2xl font-semibold">Create an exam</h1>
            <p className="mt-1 text-sm text-muted">Build a custom practice paper and save it to your test library.</p>
          </div>
          <span className="rounded-full bg-page px-3 py-1.5 text-xs font-medium text-muted">{preview} questions ready</span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">Test title
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium">Duration (minutes)
            <input type="number" min="1" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium">Section / subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics, Chemistry, Mathematics…" className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium">Description
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
          </label>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Questions</h2>
          <span className="text-xs text-muted">Default marking: +4 / −1</span>
        </div>

        <div className="mt-3 space-y-4">
          {questions.map((q, index) => (
            <section key={index} className="rounded-xl border border-line p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Question {index + 1}</h3>
                <button type="button" onClick={() => removeQuestion(index)} disabled={questions.length === 1} className="text-xs font-medium text-danger disabled:opacity-40">Remove</button>
              </div>
              <label className="mt-3 block text-sm font-medium">Question statement
                <textarea rows={3} value={q.text} onChange={(e) => updateQuestion(index, { text: e.target.value })} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" placeholder="Type the complete question…" />
              </label>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Question type
                  <select value={q.type} onChange={(e) => updateQuestion(index, { type: e.target.value as DraftQuestion['type'], answer: e.target.value === 'numeric' ? '' : 'a' })} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal">
                    <option value="single">Single correct (MCQ)</option>
                    <option value="multiple">Multiple correct (MSQ)</option>
                    <option value="numeric">Numerical answer</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Correct answer
                  <input value={q.answer} onChange={(e) => updateQuestion(index, { answer: e.target.value })} placeholder={q.type === 'numeric' ? 'e.g. 42' : 'e.g. a or a,c'} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
                </label>
              </div>
              {q.type !== 'numeric' && (
                <label className="mt-3 block text-sm font-medium">Options (one per line; IDs are a, b, c…)
                  <textarea rows={4} value={q.options} onChange={(e) => updateQuestion(index, { options: e.target.value })} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
                </label>
              )}
              <label className="mt-3 block text-sm font-medium">Solution / explanation (optional)
                <textarea rows={2} value={q.solution} onChange={(e) => updateQuestion(index, { solution: e.target.value })} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" placeholder="Add a worked explanation for post-test review…" />
              </label>
            </section>
          ))}
        </div>

        <button type="button" className={btn('outline') + ' mt-4'} onClick={addQuestion}>+ Add question</button>
        {errors.length > 0 && (
          <ul role="alert" className="mt-4 list-disc space-y-1 rounded-lg bg-danger/10 py-3 pr-3 pl-7 text-sm text-danger">
            {errors.map((error, i) => <li key={i}>{error}</li>)}
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
          <button type="button" className={btn('primary')} onClick={save}>Validate & save exam</button>
          <button type="button" className={btn('outline')} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </main>
  );
}
