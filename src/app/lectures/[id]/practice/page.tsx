import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";
import { isAIConfigured } from "@/lib/ai/provider";
import { buildSlideContext, hasEnoughText } from "@/lib/ai/prompts";
import PracticeClient, { type PracticeExercise } from "./PracticeClient";

export const metadata = { title: "Practice - FoodTech Study" };

export default async function PracticePage({
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
      slides: { orderBy: { index: "asc" } },
      flashcards: { orderBy: { createdAt: "asc" } },
      exercises: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!lecture) notFound();

  const configured = isAIConfigured();
  const context = buildSlideContext(lecture.slides);
  const enoughText = hasEnoughText(context);

  // Decode stored MCQ options (JSON string) for the client.
  const exercises: PracticeExercise[] = lecture.exercises.map((e) => ({
    id: e.id,
    type: e.type === "mcq" ? "mcq" : "short",
    question: e.question,
    answer: e.answer,
    options: decodeOptions(e.options),
  }));

  const flashcards = lecture.flashcards.map((f) => ({
    id: f.id,
    front: f.front,
    back: f.back,
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
        <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
        <p className="text-sm text-foreground/60">
          Review flashcards and work through practice questions. Reviewing and
          revealing answers works offline; generating new material uses AI.
        </p>
      </div>

      <PracticeClient
        lectureId={lecture.id}
        initialFlashcards={flashcards}
        initialExercises={exercises}
        aiConfigured={configured}
        enoughText={enoughText}
      />
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
