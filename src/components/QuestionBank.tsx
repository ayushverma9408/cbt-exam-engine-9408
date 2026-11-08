import { useMemo, useState } from 'react';
import { parseExam, type ExamDef } from '../engine/schema';
import { JEE_QUESTION_BANK, type Difficulty, type Subject } from '../data/jee-question-bank';
import { btn } from './ExamRoom';

const SUBJECTS: Array<'All' | Subject> = ['All', 'Physics', 'Chemistry', 'Mathematics'];
const LEVELS: Array<'All' | Difficulty> = ['All', 'Easy', 'Medium', 'Hard'];

export function QuestionBank({ onCreate, onCancel }: { onCreate: (exam: ExamDef) => void; onCancel: () => void }) {
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('All');
  const [difficulty, setDifficulty] = useState<(typeof LEVELS)[number]>('All');
  const [topic, setTopic] = useState('All');
  const [selected, setSelected] = useState<string[]>([]);
  const [duration, setDuration] = useState('45');
  const [negative, setNegative] = useState('1');
  const [errors, setErrors] = useState<string[]>([]);

  const topics = useMemo(() => ['All', ...new Set(JEE_QUESTION_BANK
    .filter((q) => subject === 'All' || q.subject === subject)
    .map((q) => q.topic))], [subject]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return JEE_QUESTION_BANK.filter((entry) => {
      const matchesSubject = subject === 'All' || entry.subject === subject;
      const matchesLevel = difficulty === 'All' || entry.difficulty === difficulty;
      const matchesTopic = topic === 'All' || entry.topic === topic;
      const haystack = [entry.question.text, entry.subject, entry.topic, entry.subtopic].join(' ').toLowerCase();
      return matchesSubject && matchesLevel && matchesTopic && (!needle || haystack.includes(needle));
    });
  }, [search, subject, difficulty, topic]);

  const toggle = (id: string) => setSelected((current) =>
    current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);

  const changeSubject = (value: (typeof SUBJECTS)[number]) => {
    setSubject(value);
    setTopic('All');
  };

  const createMock = () => {
    const chosen = JEE_QUESTION_BANK.filter((entry) => selected.includes(entry.id));
    if (!chosen.length) {
      setErrors(['Select at least one question to create a mock test.']);
      return;
    }
    const grouped = (['Physics', 'Chemistry', 'Mathematics'] as Subject[])
      .map((name) => ({
        id: name.toLowerCase(),
        name,
        marking: { correct: 4, incorrect: Number(negative), partial: false },
        questions: chosen.filter((entry) => entry.subject === name).map((entry) => entry.question),
      }))
      .filter((section) => section.questions.length);

    const candidate = {
      id: `jee-bank-${Date.now()}`,
      title: 'JEE Main — Custom Question Bank Mock',
      description: `A custom mock assembled from ${chosen.length} curated practice questions.`,
      durationMinutes: Number(duration),
      instructions: [
        'This mock was assembled from the built-in original JEE practice question bank.',
        'Each single-correct, multiple-correct and numerical question is evaluated by the exam engine.',
        'Each correct answer awards 4 marks; the selected negative-marking value applies to an incorrect answer.',
        'Review the question carefully and save your response before moving on.',
      ],
      sections: grouped,
    };
    const parsed = parseExam(candidate);
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }
    setErrors([]);
    onCreate(parsed.exam);
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <button type="button" onClick={onCancel} className="text-sm text-muted hover:text-ink">← Back to tests</button>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">JEE Main practice library</p>
          <h1 className="mt-1 text-2xl font-semibold">Question bank</h1>
          <p className="mt-1 text-sm text-muted">Browse original practice questions by subject, topic and difficulty, then assemble a mock.</p>
        </div>
        <div className="rounded-xl border border-line bg-white px-4 py-2 text-right">
          <div className="text-2xl font-semibold tabular-nums">{selected.length}</div>
          <div className="text-xs text-muted">selected / {JEE_QUESTION_BANK.length}</div>
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-xl border border-line bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-muted sm:col-span-2">Search questions
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search topic or question text…" className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink" />
        </label>
        <label className="text-xs font-semibold text-muted">Subject
          <select value={subject} onChange={(e) => changeSubject(e.target.value as (typeof SUBJECTS)[number])} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink">
            {SUBJECTS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted">Difficulty
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as (typeof LEVELS)[number])} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink">
            {LEVELS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted sm:col-span-2">Topic
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 text-sm font-normal text-ink">
            {topics.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button type="button" className={btn('outline') + ' w-full'} onClick={() => { setSearch(''); setSubject('All'); setDifficulty('All'); setTopic('All'); }}>Clear filters</button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span>Showing {filtered.length} of {JEE_QUESTION_BANK.length} questions</span>
        <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setSelected(filtered.map((q) => q.id))}>Select visible</button>
      </div>

      <div className="mt-3 space-y-3">
        {filtered.map((entry) => {
          const checked = selected.includes(entry.id);
          return (
            <article key={entry.id} className={`rounded-xl border bg-white p-4 transition-colors ${checked ? 'border-brand ring-1 ring-brand/20' : 'border-line'}`}>
              <div className="flex items-start gap-3">
                <input type="checkbox" aria-label={`Select ${entry.id}`} checked={checked} onChange={() => toggle(entry.id)} className="mt-1 h-4 w-4 accent-[var(--color-brand)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-brand">{entry.subject}</span>
                    <span className="text-muted">· {entry.topic} / {entry.subtopic}</span>
                    <span className={`rounded-full px-2 py-0.5 ${entry.difficulty === 'Easy' ? 'bg-green-50 text-green-700' : entry.difficulty === 'Medium' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{entry.difficulty}</span>
                    <span className="rounded-full bg-page px-2 py-0.5 text-muted">{entry.question.type === 'single' ? 'MCQ' : entry.question.type === 'multiple' ? 'MSQ' : 'Numerical'}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-ink">{entry.question.text}</p>
                  {('options' in entry.question) && (
                    <ol className="mt-2 grid gap-1 text-sm text-muted sm:grid-cols-2">
                      {entry.question.options.map((option) => <li key={option.id}><span className="mr-1 font-semibold">{option.id.toUpperCase()}.</span>{option.text}</li>)}
                    </ol>
                  )}
                  {entry.question.solution && <details className="mt-2 text-sm"><summary className="cursor-pointer font-medium text-brand">View explanation</summary><p className="mt-1 text-muted">{entry.question.solution}</p></details>}
                </div>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && <div className="rounded-xl border border-dashed border-line-strong bg-white p-8 text-center text-sm text-muted">No questions match these filters.</div>}
      </div>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Build your mock test</h2>
        <p className="mt-1 text-sm text-muted">Selected questions are grouped into subject sections. The standard practice marking profile is +4 for correct answers and your chosen penalty for incorrect answers.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium">Duration (minutes)
            <input type="number" min="1" max="600" value={duration} onChange={(e) => setDuration(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal" />
          </label>
          <label className="text-sm font-medium">Negative marks for incorrect answer
            <select value={negative} onChange={(e) => setNegative(e.target.value)} className="mt-1.5 w-full rounded-lg border border-line-strong px-3 py-2 font-normal">
              <option value="0">0 (no penalty)</option>
              <option value="1">−1</option>
              <option value="2">−2</option>
            </select>
          </label>
        </div>
        {errors.length > 0 && <ul role="alert" className="mt-3 list-disc rounded-lg bg-danger/10 py-2 pl-7 pr-3 text-sm text-danger">{errors.map((error) => <li key={error}>{error}</li>)}</ul>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className={btn('primary')} onClick={createMock} disabled={selected.length === 0}>Create mock from {selected.length} questions →</button>
          <button type="button" className={btn('outline')} onClick={() => setSelected([])}>Clear selection</button>
        </div>
      </section>
    </main>
  );
}
