import { useEffect, useMemo, useState } from 'react';
import { flatQuestions, hasValue, statusCounts, type Action, type AttemptState, type Status } from '../engine/attempt';
import type { ExamDef, Response } from '../engine/schema';

const STATUS_LABEL: Record<Status, string> = {
  'not-visited': 'Not visited',
  'not-answered': 'Not answered',
  answered: 'Answered',
  marked: 'Marked for review',
  'answered-marked': 'Answered & marked (will be evaluated)',
};

export function ExamRoom({
  exam,
  attempt,
  dispatch,
}: {
  exam: ExamDef;
  attempt: AttemptState;
  dispatch: (a: Action) => void;
}) {
  const all = useMemo(() => flatQuestions(exam), [exam]);
  const q = all.find((x) => x.id === attempt.current);
  const section = q ? exam.sections.find((s) => s.id === q.sectionId) : undefined;
  if (!q || !section || !attempt.questions[q.id]) {
    return (
      <main className="grid min-h-screen place-items-center bg-page p-6">
        <section role="alert" className="max-w-lg rounded-2xl border border-danger/30 bg-white p-6">
          <h1 className="text-lg font-semibold">This attempt could not be restored</h1>
          <p className="mt-2 text-sm text-muted">The saved question state does not match this exam. Return to the test list and start a fresh attempt.</p>
        </section>
      </main>
    );
  }
  const state = attempt.questions[q.id];
  const marking = q.marking ?? section.marking;
  const [confirming, setConfirming] = useState(false);
  const remaining = useCountdown(attempt.endsAt);

  // Auto-submit when time runs out.
  useEffect(() => {
    if (remaining <= 0) dispatch({ type: 'submit', now: attempt.endsAt });
  }, [remaining, dispatch, attempt.endsAt]);

  const act = (type: 'save-next' | 'mark-next' | 'save-mark-next') => dispatch({ type, now: timestamp() });
  const goto = (id: string) => dispatch({ type: 'goto', id, now: timestamp() });
  const index = all.findIndex((x) => x.id === q.id);

  return (
    <div className="flex h-screen flex-col bg-page">
      {/* Top bar */}
      <header className="border-b border-[#163d65] bg-[#1d4f7a] px-4 py-2.5 text-white">
        <div className="flex items-center gap-4">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded bg-white/15 text-xs font-bold tracking-wide">JEE</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-wide">JOINT ENTRANCE EXAMINATION</div>
            <div className="text-xs text-white/75">Computer Based Test · {exam.title}</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/70">Time left</div>
            <div
              className={`rounded-md px-3 py-1 font-mono text-xl font-bold tabular-nums ${remaining < Math.min(5 * 60_000, exam.durationMinutes * 60_000 * 0.2) ? 'bg-white text-danger' : 'bg-white text-[#1d4f7a]'}`}
              role="timer"
              aria-label="Time left"
            >
              {clock(remaining)}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-2 text-xs text-white/80">
          <span>Candidate: Guest</span>
          <span>{all.length} questions · {exam.sections.length} sections</span>
        </div>
      </header>

      {/* Section tabs */}
      <nav className="flex gap-1 overflow-x-auto border-b border-line bg-[#eaf1f8] px-3" aria-label="Sections">
        {exam.sections.map((s) => {
          const ids = s.questions.map((x) => x.id);
          const answered = ids.filter((id) =>
            ['answered', 'answered-marked'].includes(attempt.questions[id].status),
          ).length;
          const active = s.id === section.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goto(s.questions[0].id)}
              aria-current={active}
              className={`shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium ${active ? 'border-brand text-brand' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {s.name}{' '}
              <span className="ml-1 rounded-full bg-page px-1.5 py-0.5 text-xs tabular-nums">
                {answered}/{ids.length}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 flex-1">
        {/* Question */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-line bg-white px-5 py-2.5 text-sm">
            <span className="font-semibold text-[#1d4f7a]">Question {q.number} <span className="ml-2 font-normal text-muted">({section.name})</span></span>
            <span className="flex gap-3 text-xs text-muted">
              <span>
                {q.type === 'single'
                  ? 'Single correct'
                  : q.type === 'multiple'
                    ? 'One or more correct'
                    : 'Numerical answer'}
              </span>
              <span className="text-success">+{marking.correct}</span>
              {marking.incorrect > 0 && <span className="text-danger">−{marking.incorrect}</span>}
              {q.type === 'multiple' && marking.partial && <span className="text-brand">partial marking</span>}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-6">
            <p className="max-w-3xl text-[17px] leading-relaxed">{q.text}</p>
            <div className="mt-6 max-w-3xl">
              <Answer q={q} value={state.draft} onChange={(value) => dispatch({ type: 'draft', value })} />
            </div>
          </div>

          {/* Action bar */}
          <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-white px-4 py-3">
            <button type="button" className={btn('outline')} onClick={() => act('mark-next')}>
              Mark for Review &amp; Next
            </button>
            <button
              type="button"
              className={btn('outline')}
              onClick={() => dispatch({ type: 'clear' })}
              disabled={!hasValue(state.draft) && !hasValue(state.response)}
            >
              Clear Response
            </button>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                className={btn('outline')}
                onClick={() => goto(all[index - 1].id)}
                disabled={index === 0}
              >
                ← Back
              </button>
              <button type="button" className={btn('primary')} onClick={() => act('save-next')}>
                Save &amp; Next →
              </button>
            </div>
          </footer>
        </main>

        {/* Palette */}
        <aside className="hidden w-80 shrink-0 flex-col border-l border-line bg-white md:flex">
          <Legend attempt={attempt} />
          <div className="flex-1 overflow-y-auto p-4">
            {exam.sections.map((s) => (
              <div key={s.id} className="mb-5">
                <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">{s.name}</div>
                <div className="grid grid-cols-5 gap-2">
                  {all
                    .filter((x) => x.sectionId === s.id)
                    .map((x) => (
                      <PaletteButton
                        key={x.id}
                        number={x.number}
                        status={attempt.questions[x.id].status}
                        current={x.id === q.id}
                        onClick={() => goto(x.id)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-line p-4">
            <button type="button" className={`${btn('primary')} w-full`} onClick={() => setConfirming(true)}>
              Submit Test
            </button>
          </div>
        </aside>
      </div>

      {/* Mobile palette + submit */}
      <div className="flex gap-2 overflow-x-auto border-t border-line bg-white p-2 md:hidden">
        {all.map((x) => (
          <PaletteButton
            key={x.id}
            number={x.number}
            status={attempt.questions[x.id].status}
            current={x.id === q.id}
            onClick={() => goto(x.id)}
          />
        ))}
        <button type="button" className={`${btn('primary')} shrink-0`} onClick={() => setConfirming(true)}>
          Submit
        </button>
      </div>

      {confirming && (
        <SubmitDialog
          exam={exam}
          attempt={attempt}
          onCancel={() => setConfirming(false)}
          onSubmit={() => dispatch({ type: 'submit', now: timestamp() })}
        />
      )}
    </div>
  );
}

function Answer({
  q,
  value,
  onChange,
}: {
  q: ReturnType<typeof flatQuestions>[number];
  value: Response | null;
  onChange: (v: Response | null) => void;
}) {
  if (q.type === 'numeric') {
    return (
      <label className="flex max-w-xs flex-col gap-2 text-sm">
        <span className="text-muted">Enter your answer</span>
        <input
          inputMode="decimal"
          className="rounded-lg border border-line-strong px-3 py-2.5 text-lg tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand/25"
          value={typeof value === 'number' || typeof value === 'string' ? String(value) : ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^\d.-]/g, '');
            // Keep partial input like "-" or "3." as a string until it parses.
            onChange(raw === '' ? null : /^-?\d*\.?\d+$/.test(raw) ? Number(raw) : raw);
          }}
        />
      </label>
    );
  }

  const multiple = q.type === 'multiple';
  const selected = new Set(Array.isArray(value) ? value : typeof value === 'string' ? [value] : []);
  const toggle = (id: string) => {
    if (!multiple) return onChange(id);
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next].sort());
  };

  return (
    <div role={multiple ? 'group' : 'radiogroup'} className="flex flex-col gap-2.5">
      {q.options.map((o, i) => {
        const on = selected.has(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role={multiple ? 'checkbox' : 'radio'}
            aria-checked={on}
            onClick={() => toggle(o.id)}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${on ? 'border-brand bg-brand/5 ring-1 ring-brand' : 'border-line bg-white hover:border-line-strong'}`}
          >
            <span
              className={`grid h-7 w-7 shrink-0 place-items-center text-sm font-semibold ${multiple ? 'rounded-md' : 'rounded-full'} ${on ? 'bg-brand text-white' : 'border border-line-strong text-muted'}`}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span>{o.text}</span>
          </button>
        );
      })}
    </div>
  );
}

export function PaletteButton({
  number,
  status,
  current,
  onClick,
}: {
  number: number;
  status: Status;
  current?: boolean;
  onClick?: () => void;
}) {
  const styles: Record<Status, string> = {
    'not-visited': 'bg-page text-ink border border-line-strong rounded-md',
    'not-answered': 'bg-danger text-white rounded-t-xl rounded-b-md',
    answered: 'bg-success text-white rounded-b-xl rounded-t-md',
    marked: 'bg-purple text-white rounded-full',
    'answered-marked': 'bg-purple text-white rounded-full',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Question ${number}: ${STATUS_LABEL[status]}`}
      aria-current={current}
      className={`relative grid h-10 w-10 shrink-0 place-items-center text-sm font-semibold tabular-nums ${styles[status]} ${current ? 'ring-2 ring-brand ring-offset-2' : ''}`}
    >
      {number}
      {status === 'answered-marked' && (
        <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-white bg-success" />
      )}
    </button>
  );
}

function Legend({ attempt }: { attempt: AttemptState }) {
  const counts = statusCounts(attempt);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-b border-line p-4 text-xs">
      {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
        <div key={s} className={`flex items-center gap-2 ${s === 'answered-marked' ? 'col-span-2' : ''}`}>
          <span className="scale-75">
            <PaletteButton number={counts[s]} status={s} />
          </span>
          <span className="text-muted">{STATUS_LABEL[s]}</span>
        </div>
      ))}
    </div>
  );
}

function SubmitDialog({
  exam,
  attempt,
  onCancel,
  onSubmit,
}: {
  exam: ExamDef;
  attempt: AttemptState;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-title"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
        <h2 id="submit-title" className="text-lg font-semibold">
          Submit your test?
        </h2>
        <p className="mt-1 text-sm text-muted">You can't change answers after submitting. Here's your summary:</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted">
              <tr>
                <th className="py-2 font-medium">Section</th>
                <th className="py-2 text-center font-medium">Answered</th>
                <th className="py-2 text-center font-medium">Not answered</th>
                <th className="py-2 text-center font-medium">Marked</th>
                <th className="py-2 text-center font-medium">Not visited</th>
              </tr>
            </thead>
            <tbody>
              {exam.sections.map((s) => {
                const c = statusCounts(
                  attempt,
                  s.questions.map((q) => q.id),
                );
                return (
                  <tr key={s.id} className="border-t border-line">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td className="py-2 text-center text-success tabular-nums">{c.answered + c['answered-marked']}</td>
                    <td className="py-2 text-center text-danger tabular-nums">{c['not-answered']}</td>
                    <td className="py-2 text-center text-purple tabular-nums">{c.marked + c['answered-marked']}</td>
                    <td className="py-2 text-center tabular-nums">{c['not-visited']}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className={btn('outline')} onClick={onCancel} autoFocus>
            Keep going
          </button>
          <button type="button" className={btn('primary')} onClick={onSubmit}>
            Submit test
          </button>
        </div>
      </div>
    </div>
  );
}

function useCountdown(endsAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, endsAt - now);
}

/** Event-time timestamp for reducer actions. */
const timestamp = () => Date.now();

export function clock(ms: number) {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const btn = (variant: 'primary' | 'outline' | 'purple') =>
  `inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-strong'
      : variant === 'purple'
        ? 'bg-purple text-white hover:brightness-110'
        : 'border border-line-strong bg-white text-ink hover:bg-page'
  }`;
