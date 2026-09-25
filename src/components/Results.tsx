import { useMemo, useState } from 'react';
import { flatQuestions, type AttemptState } from '../engine/attempt';
import type { ExamDef, Response } from '../engine/schema';
import { scoreAttempt, type Outcome } from '../engine/scoring';
import { btn } from './ExamRoom';

const OUTCOME_STYLE: Record<Outcome, string> = {
  correct: 'bg-success/10 text-success',
  partial: 'bg-warn/15 text-warn',
  incorrect: 'bg-danger/10 text-danger',
  unattempted: 'bg-page text-muted',
};

export function Results({
  exam,
  attempt,
  onRetake,
  onHome,
}: {
  exam: ExamDef;
  attempt: AttemptState;
  onRetake: () => void;
  onHome: () => void;
}) {
  const result = useMemo(() => scoreAttempt(exam, attempt), [exam, attempt]);
  const questions = useMemo(() => flatQuestions(exam), [exam]);
  const [filter, setFilter] = useState<'all' | Outcome>('all');
  const byId = Object.fromEntries(result.questions.map((r) => [r.id, r]));
  const maxTime = Math.max(1, ...result.questions.map((q) => q.timeSpentMs));
  const counts = (o: Outcome) => result.questions.filter((q) => q.outcome === o).length;

  return (
    <div className="min-h-screen bg-page">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <div>
            <div className="text-xs font-medium text-muted uppercase">Result</div>
            <h1 className="text-lg font-semibold">{exam.title}</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <button type="button" className={btn('outline')} onClick={onHome}>
              All tests
            </button>
            <button type="button" className={btn('primary')} onClick={onRetake}>
              Retake
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-6">
        {/* Summary */}
        <section className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="grid place-items-center rounded-2xl border border-line bg-white p-5">
            <ScoreRing value={result.percentage} />
            <div className="mt-2 text-center">
              <div className="text-2xl font-semibold tabular-nums">
                {result.score} <span className="text-base text-muted">/ {result.maxScore}</span>
              </div>
              <div className="text-xs text-muted">marks</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Accuracy" value={`${result.accuracy}%`} hint="correct ÷ attempted" />
            <Stat label="Attempted" value={`${result.attempted} / ${result.questions.length}`} />
            <Stat label="Time taken" value={duration(result.timeTakenMs)} hint={`of ${exam.durationMinutes} min`} />
            <Stat label="Correct" value={String(counts('correct'))} tone="success" />
            <Stat
              label="Incorrect"
              value={String(counts('incorrect'))}
              tone="danger"
              hint={counts('partial') ? `${counts('partial')} partial` : undefined}
            />
            <Stat label="Lost to negative marking" value={`−${result.negativeMarks}`} tone="danger" />
          </div>
        </section>

        {/* Sections */}
        <section className="overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-page text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Section</th>
                <th className="px-3 py-2.5 text-right font-medium">Score</th>
                <th className="px-3 py-2.5 text-right font-medium">Correct</th>
                <th className="px-3 py-2.5 text-right font-medium">Incorrect</th>
                <th className="px-3 py-2.5 text-right font-medium">Skipped</th>
                <th className="px-3 py-2.5 text-right font-medium">Accuracy</th>
                <th className="px-4 py-2.5 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {result.sections.map((s) => (
                <tr key={s.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {s.score}/{s.maxScore}
                  </td>
                  <td className="px-3 py-3 text-right text-success tabular-nums">
                    {s.correct}
                    {s.partial > 0 && <span className="text-warn"> +{s.partial} partial</span>}
                  </td>
                  <td className="px-3 py-3 text-right text-danger tabular-nums">{s.incorrect}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.unattempted}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{s.accuracy}%</td>
                  <td className="px-4 py-3 text-right text-muted tabular-nums">{duration(s.timeSpentMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Time per question */}
        <section className="rounded-2xl border border-line bg-white p-4">
          <h2 className="text-sm font-semibold">Time spent per question</h2>
          <p className="text-xs text-muted">Long bars on wrong answers are where to practise.</p>
          <div
            className="mt-4 flex h-40 items-end gap-1.5"
            role="img"
            aria-label="Bar chart of seconds spent on each question"
          >
            {result.questions.map((r, i) => (
              <div key={r.id} className="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  className={`w-full rounded-t ${r.outcome === 'correct' ? 'bg-success' : r.outcome === 'incorrect' ? 'bg-danger' : r.outcome === 'partial' ? 'bg-warn' : 'bg-line-strong'}`}
                  style={{ height: `${Math.max(2, (r.timeSpentMs / maxTime) * 100)}%` }}
                />
                <span className="mt-1 text-center text-[10px] text-muted tabular-nums">{i + 1}</span>
                <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[11px] whitespace-nowrap text-white group-hover:block">
                  {Math.round(r.timeSpentMs / 1000)}s · {r.outcome}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Review */}
        <section className="rounded-2xl border border-line bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold">Answer review</h2>
            <div className="flex gap-1 text-xs" role="radiogroup" aria-label="Filter">
              {(['all', 'correct', 'partial', 'incorrect', 'unattempted'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-3 py-1 capitalize ${filter === f ? 'bg-ink text-white' : 'bg-page text-muted hover:text-ink'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </header>
          <ol className="divide-y divide-line">
            {questions
              .filter((q) => filter === 'all' || byId[q.id].outcome === filter)
              .map((q) => {
                const r = byId[q.id];
                return (
                  <li key={q.id} className="px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-sm font-semibold text-muted tabular-nums">Q{q.number}</span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{q.text}</p>
                        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                          <span>
                            <span className="text-muted">Your answer: </span>
                            {formatAnswer(q, r.response)}
                          </span>
                          <span>
                            <span className="text-muted">Correct: </span>
                            <span className="font-medium text-success">{formatAnswer(q, q.answer)}</span>
                          </span>
                          <span className="text-muted">{Math.round(r.timeSpentMs / 1000)}s</span>
                        </div>
                        {q.solution && (
                          <p className="mt-2 rounded-lg bg-page px-3 py-2 text-sm text-muted">{q.solution}</p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold capitalize tabular-nums ${OUTCOME_STYLE[r.outcome]}`}
                      >
                        {r.outcome} {r.marks > 0 ? `+${r.marks}` : r.marks < 0 ? r.marks : ''}
                      </span>
                    </div>
                  </li>
                );
              })}
          </ol>
        </section>
      </main>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--color-page)" strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-2xl font-bold tabular-nums">
        {Math.round(value)}%
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'success' | 'danger';
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div className="text-xs text-muted">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold tabular-nums ${tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : ''}`}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

function formatAnswer(q: ReturnType<typeof flatQuestions>[number], value: Response | null): string {
  if (value == null || (Array.isArray(value) && !value.length)) return '—';
  if (q.type === 'numeric') return String(value);
  const ids = Array.isArray(value) ? value : [String(value)];
  return ids
    .map((id) => {
      const i = q.options.findIndex((o) => o.id === id);
      return i < 0 ? id : `${String.fromCharCode(65 + i)}. ${q.options[i].text}`;
    })
    .join(', ');
}

const duration = (ms: number) => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
};
