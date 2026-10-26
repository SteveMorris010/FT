import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";
import type { ExamQuestion } from "@/lib/exam";
import ExamineClient from "./ExamineClient";

export const metadata = { title: "Examine - FoodTech Study" };

export default async function ExaminePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const lecture = await prisma.lecture.findFirst({
    where: lectureOwnershipWhere(id, user.id),
    include: {
      exercises: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!lecture) notFound();

  // Decode stored exercises into gradable questions. This is all the exam
  // engine needs; no AI is involved in taking or scoring the exam.
  const questions: ExamQuestion[] = lecture.exercises.map((e) => ({
    id: e.id,
    type: e.type === "mcq" ? "mcq" : "short",
    question: e.question,
    answer: e.answer,
    options: decodeOptions(e.options),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/lectures/${lecture.id}`}
          className="text-sm text-foreground/50 transition-colors hover:text-accent"
        >
          &larr; {lecture.title}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Examine</h1>
        <p className="text-sm text-foreground/60">
          Take a timed mock exam over this lecture&apos;s questions. The timer,
          scoring, and feedback all work offline once questions exist.
        </p>
        <p className="text-xs text-foreground/40">
          Grading note: multiple-choice is scored on the exact option you pick.
          Short answers are matched leniently (case, spacing, and punctuation
          are ignored) but must match the stored answer as a whole, so there is
          no partial credit and reworded answers may be marked wrong. Use the
          per-question feedback to compare against the model answer.
        </p>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground/70">
          There are no questions for this lecture yet. Go to{" "}
          <Link
            href={`/lectures/${lecture.id}/practice`}
            className="font-medium text-accent hover:underline"
          >
            Practice
          </Link>{" "}
          and generate a question set first, then come back to sit a timed exam.
        </p>
      ) : (
        <ExamineClient lectureId={lecture.id} questions={questions} />
      )}
    </div>
  );
}

/** Decode a stored JSON options string into a string[] (empty on failure). */
function decodeOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((o): o is string => typeof o === "string");
    }
  } catch {
    // Ignore malformed stored options.
  }
  return [];
}
