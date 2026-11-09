import { useState } from 'react';
import { parseExam, type ExamDef, type QuestionDef } from '../engine/schema';
import { extractQuestionsFromPdf, type ExtractProgress, type ExtractedQuestion } from '../lib/pdf-question-extractor';
import { btn } from './ExamRoom';

type Draft = {
  id: number;
  stem: string;
  type: 'single' | 'multiple' | 'numeric';
  options: string[];
  answer: string;
  solution: string;
};

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics'] as const;
type Subject = (typeof SUBJECTS)[number];

function toDraft(question: ExtractedQuestion, index: number): Draft {
  return {
    id: index + 1,
    stem: question.stem,
    type: question.options.length >= 2 ? 'single' : 'numeric',
    options: [...question.options.slice(0, 6), ...Array(Math.max(0, 4 - question.options.length)).fill('')],
    answer: '',
    solution: '',
  };
}

export function PdfQuestionImporter({ onCreate, onCancel }: { onCreate: (exam: ExamDef) => void; onCancel: () => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState<ExtractProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState<Subject>('Physics');
  const [duration, setDuration] = useState('60');
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  const update = (id: number, patch: Partial<Draft>) =>
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));

  const readPdf = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setErrors([]);
    setNotice('');
    setDrafts([]);
    setFileName(file.name);
    setProgress(null);
    try {
      const questions = await extractQuestionsFromPdf(file, setProgress);
      setDrafts(questions.map(toDraft));
      setNotice(`Detected ${questions.length} question block(s). Check every question and answer before importing.`);
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'Could not read this PDF.']);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const createExam = () => {
    const questions: QuestionDef[] = [];
    const problems: string[] = [];
    for (const draft of drafts) {
      const stem = draft.stem.trim();
      if (!stem) {
        problems.push(`Question ${draft.id}: question text is empty.`);
        continue;
      }
      if (draft.type === 'numeric') {
        const answer = Number(draft.answer);
        if (!draft.answer.trim() || !Number.isFinite(answer)) {
          problems.push(`Question ${draft.id}: enter a valid numerical answer.`);
          continue;
        }
        questions.push({
          id: `pdf-q-${draft.id}`, type: 'numeric', text: stem, answer,
          tolerance: 0.01, ...(draft.solution.trim() ? { solution: draft.solution.trim() } : {}),
        });
        continue;
      }

      const options = draft.options.map((value, index) => ({ id: String.fromCharCode(65 + index), text: value.trim() })).filter((option) => option.text);
      if (options.length < 2) {
        problems.push(`Question ${draft.id}: at least two non-empty options are required.`);
        continue;
      }
      const answers = draft.answer.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean);
      const optionIds = new Set(options.map((option) => option.id));
      if (!answers.length || answers.some((answer) => !optionIds.has(answer)) || new Set(answers).size !== answers.length) {
        problems.push(`Question ${draft.id}: choose a valid answer from the available option labels.`);
        continue;
      }
      if (draft.type === 'single' && answers.length !== 1) {
        problems.push(`Question ${draft.id}: single-correct questions need exactly one answer.`);
        continue;
      }
      questions.push(draft.type === 'single'
        ? { id: `pdf-q-${draft.id}`, type: 'single', text: stem, options, answer: answers[0], ...(draft.solution.trim() ? { solution: draft.solution.trim() } : {}) }
        : { id: `pdf-q-${draft.id}`, type: 'multiple', text: stem, options, answer: answers, ...(draft.solution.trim() ? { solution: draft.solution.trim() } : {}) });
    }
    if (problems.length) {
      setErrors(problems.slice(0, 10));
      return;
    }
    if (!questions.length) {
      setErrors(['Extract a PDF and review at least one question before importing.']);
      return;
    }
    const parsed = parseExam({
      id: `pdf-import-${Date.now()}`,
      title: `PDF Practice — ${fileName.replace(/\.pdf$/i, '') || 'Imported paper'}`,
      description: `Questions reviewed and imported from ${fileName}.`,
      durationMinutes: Number(duration),
      instructions: [
        'Questions were extracted from a user-provided PDF. Review the imported question wording and answer keys carefully.',
        'Correct answers award 4 marks and incorrect answers deduct 1 mark.',
        'PDF diagrams and mathematical formatting may require manual correction.',
      ],
      sections: [{
        id: subject.toLowerCase(),
        name: subject,
        marking: { correct: 4, incorrect: 1, partial: false },
        questions,
      }],
    });
    if (!parsed.ok) {
      setErrors(parsed.errors.slice(0, 10));
      return;
    }
    onCreate(parsed.exam);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">← Back to tests</button>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand">PDF import · local processing</p>
        <h1 className="mt-1 text-2xl font-semibold">Fetch questions from a PDF</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">Supports selectable-text PDFs, scanned/image-only PDFs and mixed PDFs. OCR runs in your browser; the PDF itself is not uploaded to an application server.</p>
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <label className="block text-sm font-semibold">Choose a question-paper PDF
          <input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={(event) => readPdf(event.target.files?.[0])} className="mt-2 block w-full rounded-lg border border-line-strong p-3 text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-brand file:px-3 file:py-2 file:text-white" />
        </label>
        <p className="mt-2 text-xs text-muted">Maximum 25 MB and 80 pages. English OCR is enabled. PDF reading and OCR libraries load from public CDNs and require an internet connection.</p>
        {busy && (
          <div className="mt-4 rounded-lg bg-page p-3" role="status">
            <p className="text-sm font-medium">{progress?.stage === 'ocr' ? 'Running OCR on scanned page…' : 'Reading PDF text…'}</p>
            {progress && <p className="mt-1 text-xs text-muted">Page {progress.page} of {progress.total}</p>}
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-all" style={{ width: progress ? `${Math.round(progress.page / progress.total * 100)}%` : '8%' }} /></div>
          </div>
        )}
        {notice && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
        {errors.length > 0 && <ul role="alert" className="mt-3 list-disc rounded-lg bg-danger/10 py-2 pl-7 pr-3 text-sm text-danger">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
      </section>

      {drafts.length > 0 && (
        <>
          <section className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4">
            <label className="min-w-44 flex-1 text-sm font-medium">Subject
              <select value={subject} onChange={(event) => setSubject(event.target.value as Subject)} className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 font-normal">{SUBJECTS.map((value) => <option key={value}>{value}</option>)}</select>
            </label>
            <label className="min-w-36 flex-1 text-sm font-medium">Test duration (minutes)
              <input type="number" min="1" max="600" value={duration} onChange={(event) => setDuration(event.target.value)} className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
            </label>
            <span className="text-xs text-muted">{drafts.length} detected question drafts</span>
          </section>

          <div className="mt-4 space-y-3">
            {drafts.map((draft) => (
              <article key={draft.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">Question {draft.id}</h2>
                  <div className="flex items-center gap-2">
                    <select aria-label={`Question ${draft.id} type`} value={draft.type} onChange={(event) => update(draft.id, { type: event.target.value as Draft['type'] })} className="rounded-lg border border-line-strong px-2 py-1.5 text-sm">
                      <option value="single">Single correct (MCQ)</option>
                      <option value="multiple">Multiple correct (MSQ)</option>
                      <option value="numeric">Numerical</option>
                    </select>
                    <button type="button" onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))} className="text-xs font-medium text-danger">Remove</button>
                  </div>
                </div>
                <label className="mt-3 block text-xs font-semibold text-muted">Question text
                  <textarea rows={3} value={draft.stem} onChange={(event) => update(draft.id, { stem: event.target.value })} className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink" />
                </label>
                {draft.type !== 'numeric' ? (
                  <>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {draft.options.map((option, index) => (
                        <label key={index} className="text-xs font-semibold text-muted">Option {String.fromCharCode(65 + index)}
                          <input value={option} onChange={(event) => update(draft.id, { options: draft.options.map((value, i) => i === index ? event.target.value : value) })} className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink" />
                        </label>
                      ))}
                    </div>
                    <label className="mt-3 block text-xs font-semibold text-muted">Correct option label{draft.type === 'multiple' ? 's (comma-separated)' : ''}
                      <input value={draft.answer} onChange={(event) => update(draft.id, { answer: event.target.value.toUpperCase() })} placeholder={draft.type === 'multiple' ? 'e.g. A,C' : 'e.g. B'} className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink" />
                    </label>
                  </>
                ) : (
                  <label className="mt-3 block text-xs font-semibold text-muted">Correct numerical answer
                    <input type="number" value={draft.answer} onChange={(event) => update(draft.id, { answer: event.target.value })} className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink" />
                  </label>
                )}
                <label className="mt-3 block text-xs font-semibold text-muted">Explanation / solution (optional)
                  <textarea rows={2} value={draft.solution} onChange={(event) => update(draft.id, { solution: event.target.value })} className="mt-1 block w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink" />
                </label>
              </article>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className={btn('primary')} onClick={createExam}>Validate and create test from PDF →</button>
            <button type="button" className={btn('outline')} onClick={() => setDrafts([])}>Discard extracted questions</button>
          </div>
          <p className="mt-3 text-xs text-muted">Extraction is only a starting point. Confirm every stem, option and answer key—especially equations, subscripts, diagrams and OCR output—before creating the test.</p>
        </>
      )}
    </main>
  );
}
