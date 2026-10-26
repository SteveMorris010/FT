"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  gradeExam,
  type ExamQuestion,
  type QuestionFeedback,
} from "@/lib/exam";

/** Default exam configuration. */
const DEFAULT_COUNT = 10;
const DEFAULT_MINUTES = 15;

type Phase = "config" | "running" | "result";

/**
 * Examine mode client UI - a timed mock exam.
 *
 * Everything here is pure, offline logic once questions exist:
 * - Configure the number of questions and the time limit.
 * - A countdown timer runs; on manual submit OR timeout the exam is graded.
 * - Grading uses src/lib/exam.ts (no AI). We also POST the attempt so the score
 *   and per-question feedback are persisted as an ExamAttempt, and we show the
 *   authoritative server result (falling back to the local grade on error).
 */
export default function ExamineClient({
  lectureId,
  questions,
}: {
  lectureId: string;
  questions: ExamQuestion[];
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("config");

  // Config state.
  const maxCount = questions.length;
  const [count, setCount] = useState(Math.min(DEFAULT_COUNT, maxCount));
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES);

  // Running-exam state.
  const [examQuestions, setExamQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(0);
  const startedAtRef = useRef<number>(0);
  const durationLimitRef = useRef<number>(0);

  // Result state.
  const [result, setResult] = useState<{
    score: number;
    total: number;
    feedback: QuestionFeedback[];
    durationSeconds: number;
    saved: boolean;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (auto: boolean) => {
      if (submitting) return;
      setSubmitting(true);

      const elapsed = Math.max(
        0,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      const durationSeconds = auto
        ? durationLimitRef.current
        : Math.min(elapsed, durationLimitRef.current);

      // PURE local grade for an instant result (and a fallback if the save fails).
      const local = gradeExam(examQuestions, answers);

      let final = {
        score: local.score,
        total: local.total,
        feedback: local.feedback,
        durationSeconds,
        saved: false,
      };

      try {
        const res = await fetch(`/api/lectures/${lectureId}/exam`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionIds: examQuestions.map((q) => q.id),
            answers,
            durationSeconds,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          final = {
            score: data.score,
            total: data.total,
            feedback: data.feedback,
            durationSeconds,
            saved: true,
          };
        }
      } catch {
        // Keep the local grade; the attempt just was not persisted.
      }

      setResult(final);
      setPhase("result");
      setSubmitting(false);
      router.refresh();
    },
    [answers, examQuestions, lectureId, router, submitting]
  );

  // Countdown timer. Ticks once a second while the exam is running and triggers
  // an automatic submit at zero. The submit is deferred via setTimeout so we do
  // not call setState synchronously inside the effect body.
  useEffect(() => {
    if (phase !== "running") return;
    if (remaining <= 0) {
      const t = setTimeout(() => void submit(true), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, remaining, submit]);

  function startExam() {
    const n = Math.max(1, Math.min(count, maxCount));
    // Shuffle a copy and take the first n so each attempt varies.
    const shuffled = [...questions].sort(() => Math.random() - 0.5).slice(0, n);
    const limitSeconds = Math.max(1, Math.round(minutes * 60));

    setExamQuestions(shuffled);
    setAnswers({});
    setRemaining(limitSeconds);
    startedAtRef.current = Date.now();
    durationLimitRef.current = limitSeconds;
    setResult(null);
    setPhase("running");
  }

  function restart() {
    setPhase("config");
    setExamQuestions([]);
    setAnswers({});
    setResult(null);
  }

  if (phase === "config") {
    return (
      <ExamConfig
        maxCount={maxCount}
        count={count}
        minutes={minutes}
        onCount={setCount}
        onMinutes={setMinutes}
        onStart={startExam}
      />
    );
  }

  if (phase === "running") {
    return (
      <ExamRunner
        questions={examQuestions}
        answers={answers}
        remaining={remaining}
        submitting={submitting}
        onAnswer={(qid, val) =>
          setAnswers((prev) => ({ ...prev, [qid]: val }))
        }
        onSubmit={() => void submit(false)}
      />
    );
  }

  return result ? (
    <ExamResultView result={result} onRestart={restart} />
  ) : null;
}

/* ------------------------------------------------------------------ */

function ExamConfig({
  maxCount,
  count,
  minutes,
  onCount,
  onMinutes,
  onStart,
}: {
  maxCount: number;
  count: number;
  minutes: number;
  onCount: (n: number) => void;
  onMinutes: (n: number) => void;
  onStart: () => void;
}) {
  return (
    <div className="flex max-w-md flex-col gap-5 rounded-xl border border-black/10 bg-white/50 p-6 dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Set up your exam</h2>
        <p className="text-sm text-foreground/60">
          {maxCount} question{maxCount === 1 ? "" : "s"} available for this
          lecture.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground/80">
          Number of questions
        </span>
        <input
          type="number"
          min={1}
          max={maxCount}
          value={count}
          onChange={(e) => onCount(clampInt(e.target.value, 1, maxCount, count))}
          className="rounded-md border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground/80">
          Time limit (minutes)
        </span>
        <input
          type="number"
          min={1}
          max={180}
          value={minutes}
          onChange={(e) => onMinutes(clampInt(e.target.value, 1, 180, minutes))}
          className="rounded-md border border-black/10 bg-transparent px-3 py-2 dark:border-white/15"
        />
      </label>

      <button
        type="button"
        onClick={onStart}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Start exam
      </button>
    </div>
  );
}

function ExamRunner({
  questions,
  answers,
  remaining,
  submitting,
  onAnswer,
  onSubmit,
}: {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  remaining: number;
  submitting: boolean;
  onAnswer: (qid: string, val: string) => void;
  onSubmit: () => void;
}) {
  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id] ?? "").trim().length > 0).length,
    [questions, answers]
  );
  const low = remaining <= 30;

  return (
    <div className="flex flex-col gap-5">
      <div className="sticky top-2 z-10 flex items-center justify-between gap-4 rounded-lg border border-black/10 bg-background/90 px-4 py-3 backdrop-blur dark:border-white/10">
        <span className="text-sm text-foreground/60">
          {answeredCount} / {questions.length} answered
        </span>
        <span
          aria-live="polite"
          className={
            "font-mono text-lg font-semibold tabular-nums " +
            (low ? "text-red-600 dark:text-red-400" : "text-foreground/80")
          }
        >
          {formatTime(remaining)}
        </span>
      </div>

      <ol className="flex flex-col gap-4">
        {questions.map((q, i) => (
          <li
            key={q.id}
            className="rounded-lg border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5"
          >
            <p className="text-sm font-medium text-foreground/90">
              <span className="mr-2 text-foreground/40">{i + 1}.</span>
              {q.question}
            </p>

            {q.type === "mcq" && q.options.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {q.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={answers[q.id] === opt}
                      onChange={() => onAnswer(q.id, opt)}
                      className="accent-[var(--accent)]"
                    />
                    <span>
                      {String.fromCharCode(65 + oi)}. {opt}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <input
                type="text"
                value={answers[q.id] ?? ""}
                onChange={(e) => onAnswer(q.id, e.target.value)}
                placeholder="Your answer"
                className="mt-3 w-full rounded-md border border-black/10 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              />
            )}
          </li>
        ))}
      </ol>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit exam"}
        </button>
        <span className="text-xs text-foreground/40">
          The exam is graded automatically when the timer reaches zero.
        </span>
      </div>
    </div>
  );
}

function ExamResultView({
  result,
  onRestart,
}: {
  result: {
    score: number;
    total: number;
    feedback: QuestionFeedback[];
    durationSeconds: number;
    saved: boolean;
  };
  onRestart: () => void;
}) {
  const pct = result.total > 0
    ? Math.round((result.score / result.total) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-xl border border-black/10 bg-white/50 p-6 dark:border-white/10 dark:bg-white/5">
        <h2 className="text-lg font-semibold tracking-tight">Results</h2>
        <p className="text-3xl font-semibold tracking-tight text-accent">
          {result.score} / {result.total}{" "}
          <span className="text-base font-normal text-foreground/50">
            ({pct}%)
          </span>
        </p>
        <p className="text-sm text-foreground/60">
          Time taken: {formatTime(result.durationSeconds)}.{" "}
          {result.saved
            ? "This attempt has been saved."
            : "This attempt was graded locally but could not be saved."}
        </p>
        <div>
          <button
            type="button"
            onClick={onRestart}
            className="mt-2 rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-accent/40 hover:text-accent dark:border-white/15"
          >
            Take another exam
          </button>
        </div>
      </div>

      <ol className="flex flex-col gap-3">
        {result.feedback.map((f, i) => (
          <li
            key={f.id}
            className={
              "rounded-lg border p-4 " +
              (f.correct
                ? "border-emerald-500/30 bg-emerald-500/5"
                : "border-red-500/30 bg-red-500/5")
            }
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-foreground/90">
                <span className="mr-2 text-foreground/40">{i + 1}.</span>
                {f.question}
              </p>
              <span
                className={
                  "shrink-0 rounded px-2 py-0.5 text-xs font-medium " +
                  (f.correct
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/15 text-red-700 dark:text-red-400")
                }
              >
                {f.correct ? "Correct" : "Incorrect"}
              </span>
            </div>
            <p className="mt-2 text-sm text-foreground/70">
              <span className="font-medium">Your answer: </span>
              {f.userAnswer.trim().length > 0 ? (
                f.userAnswer
              ) : (
                <span className="italic text-foreground/40">(no answer)</span>
              )}
            </p>
            {!f.correct ? (
              <p className="mt-1 text-sm text-foreground/70">
                <span className="font-medium">Correct answer: </span>
                {f.correctAnswer}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function clampInt(
  value: string,
  min: number,
  max: number,
  fallback: number
): number {
  const n = parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
