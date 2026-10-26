"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AiNotConfigured from "@/components/AiNotConfigured";

export interface PracticeFlashcard {
  id: string;
  front: string;
  back: string;
}

export interface PracticeExercise {
  id: string;
  type: "mcq" | "short";
  question: string;
  answer: string;
  options: string[];
}

/**
 * Practice mode client UI.
 *
 * Two independent, fully-offline review experiences over already-stored data,
 * plus AI "Generate" buttons that degrade gracefully (showing the
 * AiNotConfigured panel on a 503):
 *
 * 1. Flashcard review: flip to reveal, next/prev, and a self-rating
 *    (Again/Good). "Again" pushes the card toward the end of the session queue
 *    so you see it again; "Good" advances. This is pure client state - no
 *    network, works with no API key on existing cards.
 * 2. Exercise list: each question can reveal its answer. Also offline.
 */
export default function PracticeClient({
  lectureId,
  initialFlashcards,
  initialExercises,
  aiConfigured,
  enoughText,
}: {
  lectureId: string;
  initialFlashcards: PracticeFlashcard[];
  initialExercises: PracticeExercise[];
  aiConfigured: boolean;
  enoughText: boolean;
}) {
  const [flashcards, setFlashcards] =
    useState<PracticeFlashcard[]>(initialFlashcards);
  const [exercises, setExercises] =
    useState<PracticeExercise[]>(initialExercises);

  return (
    <div className="flex flex-col gap-10">
      <FlashcardReview
        lectureId={lectureId}
        cards={flashcards}
        onGenerated={setFlashcards}
        aiConfigured={aiConfigured}
        enoughText={enoughText}
      />
      <ExerciseList
        lectureId={lectureId}
        exercises={exercises}
        onGenerated={setExercises}
        aiConfigured={aiConfigured}
        enoughText={enoughText}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Flashcard review (pure client logic)                                */
/* ------------------------------------------------------------------ */

function FlashcardReview({
  lectureId,
  cards,
  onGenerated,
  aiConfigured,
  enoughText,
}: {
  lectureId: string;
  cards: PracticeFlashcard[];
  onGenerated: (cards: PracticeFlashcard[]) => void;
  aiConfigured: boolean;
  enoughText: boolean;
}) {
  // The session queue is an ordered list of card ids we reorder as the user
  // self-rates. We derive the visible queue from this plus the card map.
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [position, setPosition] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const cardMap = useMemo(() => {
    const map = new Map<string, PracticeFlashcard>();
    for (const c of cards) map.set(c.id, c);
    return map;
  }, [cards]);

  // Keep the order in sync if the card set changes (e.g. after generating).
  const activeOrder = useMemo(
    () => order.filter((id) => cardMap.has(id)),
    [order, cardMap]
  );
  const effectiveOrder =
    activeOrder.length === cardMap.size
      ? activeOrder
      : cards.map((c) => c.id);

  const safePosition = Math.min(position, Math.max(effectiveOrder.length - 1, 0));
  const currentId = effectiveOrder[safePosition];
  const current = currentId ? cardMap.get(currentId) : undefined;

  function resetSession(newCards: PracticeFlashcard[]) {
    setOrder(newCards.map((c) => c.id));
    setPosition(0);
    setFlipped(false);
  }

  function go(delta: number) {
    setFlipped(false);
    setPosition((p) => {
      const next = p + delta;
      if (next < 0) return 0;
      if (next > effectiveOrder.length - 1) return effectiveOrder.length - 1;
      return next;
    });
  }

  // "Again": move the current card to the end of the queue and stay in place
  // (the next card slides into this position). "Good": just advance.
  function rate(rating: "again" | "good") {
    setFlipped(false);
    if (!currentId) return;
    if (rating === "again") {
      setOrder((prev) => {
        const without = prev.filter((id) => id !== currentId);
        return [...without, currentId];
      });
      // Position stays the same; the moved card now sits at the end.
      setPosition((p) => Math.min(p, Math.max(effectiveOrder.length - 2, 0)));
    } else {
      go(1);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Flashcards"
        subtitle={
          cards.length > 0
            ? `${cards.length} card${cards.length === 1 ? "" : "s"} in this deck`
            : "No flashcards yet"
        }
        action={
          <GenerateButton
            lectureId={lectureId}
            kind="flashcards"
            aiConfigured={aiConfigured}
            enoughText={enoughText}
            hasExisting={cards.length > 0}
            onGenerated={(data) => {
              const next = (data as { flashcards: PracticeFlashcard[] })
                .flashcards;
              onGenerated(next);
              resetSession(next);
            }}
          />
        }
      />

      {cards.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No flashcards have been generated for this lecture yet. Use the
          Generate button to create a deck, then review it here. Reviewing works
          offline once cards exist.
        </p>
      ) : current ? (
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "Show front" : "Reveal answer"}
            className="flex min-h-56 w-full max-w-2xl flex-col items-center justify-center gap-3 rounded-2xl border border-black/10 bg-white/60 p-8 text-center transition-colors hover:border-accent/40 dark:border-white/10 dark:bg-white/5"
          >
            <span className="text-xs uppercase tracking-wide text-foreground/40">
              {flipped ? "Answer" : "Prompt"} &middot; card {safePosition + 1} of{" "}
              {effectiveOrder.length}
            </span>
            <span className="text-lg leading-relaxed text-foreground/90">
              {flipped ? current.back : current.front}
            </span>
            <span className="text-xs text-foreground/40">
              {flipped ? "Click to hide" : "Click to reveal"}
            </span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={safePosition === 0}
              className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-accent/40 disabled:opacity-40 dark:border-white/15"
            >
              &larr; Prev
            </button>
            <button
              type="button"
              onClick={() => rate("again")}
              className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-400"
            >
              Again
            </button>
            <button
              type="button"
              onClick={() => rate("good")}
              className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
            >
              Good
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={safePosition >= effectiveOrder.length - 1}
              className="rounded-md border border-black/10 px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-accent/40 disabled:opacity-40 dark:border-white/15"
            >
              Next &rarr;
            </button>
          </div>
          <p className="text-xs text-foreground/40">
            &quot;Again&quot; sends the card to the back of the queue so you see
            it again this session. &quot;Good&quot; moves on.
          </p>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Exercise list with reveal-answer (pure client logic)                */
/* ------------------------------------------------------------------ */

function ExerciseList({
  lectureId,
  exercises,
  onGenerated,
  aiConfigured,
  enoughText,
}: {
  lectureId: string;
  exercises: PracticeExercise[];
  onGenerated: (exercises: PracticeExercise[]) => void;
  aiConfigured: boolean;
  enoughText: boolean;
}) {
  return (
    <section className="flex flex-col gap-4">
      <SectionHeader
        title="Practice questions"
        subtitle={
          exercises.length > 0
            ? `${exercises.length} question${
                exercises.length === 1 ? "" : "s"
              }`
            : "No questions yet"
        }
        action={
          <GenerateButton
            lectureId={lectureId}
            kind="exercises"
            aiConfigured={aiConfigured}
            enoughText={enoughText}
            hasExisting={exercises.length > 0}
            onGenerated={(data) =>
              onGenerated(
                (data as { exercises: RawExercise[] }).exercises.map(
                  normalizeExercise
                )
              )
            }
          />
        }
      />

      {exercises.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No practice questions yet. Generate a set, then reveal answers here or
          take a timed exam in Examine mode. Both work offline once questions
          exist.
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {exercises.map((ex, i) => (
            <ExerciseItem key={ex.id} index={i + 1} exercise={ex} />
          ))}
        </ol>
      )}
    </section>
  );
}

function ExerciseItem({
  index,
  exercise,
}: {
  index: number;
  exercise: PracticeExercise;
}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <li className="rounded-lg border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-white/5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-foreground/90">
          <span className="mr-2 text-foreground/40">{index}.</span>
          {exercise.question}
          <span className="ml-2 rounded bg-black/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-foreground/50 dark:bg-white/10">
            {exercise.type}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="shrink-0 rounded-md border border-black/10 px-3 py-1 text-xs font-medium text-foreground/70 transition-colors hover:border-accent/40 hover:text-accent dark:border-white/15"
        >
          {revealed ? "Hide answer" : "Reveal answer"}
        </button>
      </div>

      {exercise.type === "mcq" && exercise.options.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {exercise.options.map((opt, oi) => {
            const isAnswer = revealed && opt === exercise.answer;
            return (
              <li
                key={oi}
                className={
                  "rounded-md px-3 py-1.5 text-sm " +
                  (isAnswer
                    ? "bg-emerald-500/15 font-medium text-emerald-700 dark:text-emerald-400"
                    : "text-foreground/70")
                }
              >
                {String.fromCharCode(65 + oi)}. {opt}
              </li>
            );
          })}
        </ul>
      ) : null}

      {revealed ? (
        <p className="mt-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-foreground/80">
          <span className="font-medium">Answer: </span>
          {exercise.answer}
        </p>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Shared helpers                                                      */
/* ------------------------------------------------------------------ */

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3 dark:border-white/10">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-foreground/50">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

interface RawExercise {
  id: string;
  type: string;
  question: string;
  answer: string;
  options: string | null;
}

/** Normalize a server exercise row (options is a JSON string) to the UI shape. */
function normalizeExercise(e: RawExercise): PracticeExercise {
  let options: string[] = [];
  if (e.options) {
    try {
      const parsed = JSON.parse(e.options);
      if (Array.isArray(parsed)) {
        options = parsed.filter((o): o is string => typeof o === "string");
      }
    } catch {
      options = [];
    }
  }
  return {
    id: e.id,
    type: e.type === "mcq" ? "mcq" : "short",
    question: e.question,
    answer: e.answer,
    options,
  };
}

/**
 * AI "Generate" button shared by both sections. Shows the AiNotConfigured panel
 * inline when the server returns 503 (no key). When AI is known to be
 * unconfigured up front, the panel is shown immediately on click.
 */
function GenerateButton({
  lectureId,
  kind,
  aiConfigured,
  enoughText,
  hasExisting,
  onGenerated,
}: {
  lectureId: string;
  kind: "flashcards" | "exercises";
  aiConfigured: boolean;
  enoughText: boolean;
  hasExisting: boolean;
  onGenerated: (data: unknown) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetch(
        `/api/lectures/${lectureId}/${kind}/generate`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not generate. Please try again.");
        return;
      }
      onGenerated(data);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const label = hasExisting
    ? `Regenerate ${kind}`
    : `Generate ${kind}`;

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={generate}
        disabled={loading || !enoughText}
        title={
          !enoughText
            ? "This deck has too little text to generate from."
            : undefined
        }
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Generating..." : label}
      </button>
      {!aiConfigured ? (
        <span className="text-xs text-foreground/40">Needs an AI key</span>
      ) : null}
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
      {notConfigured ? (
        <div className="w-full max-w-xl">
          <AiNotConfigured />
        </div>
      ) : null}
    </div>
  );
}
