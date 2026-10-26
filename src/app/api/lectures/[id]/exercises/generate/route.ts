import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AINotConfiguredError, generateText } from "@/lib/ai/provider";
import {
  STUDY_SYSTEM,
  buildExercisePrompt,
  buildSlideContext,
  hasEnoughText,
} from "@/lib/ai/prompts";
import { AiParseError, parseExercises } from "@/lib/ai/parse";

/**
 * Generate practice/exam exercises for a lecture with the AI provider.
 *
 * Loads the lecture slide text, asks the model for a JSON array of questions
 * (mcq + short), validates the shape BEFORE persisting (so malformed output
 * never reaches the DB), then replaces the lecture's exercises with the fresh
 * batch. MCQ options are stored as a JSON string (SQLite has no JSON column).
 *
 * Degrades gracefully: AINotConfiguredError becomes a 503 with a clear message
 * so the UI can show the "AI not configured" panel instead of crashing.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  const lecture = await prisma.lecture.findFirst({
    where: { id, subject: { userId: user.id } },
    include: { slides: { orderBy: { index: "asc" } } },
  });

  if (!lecture) {
    return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
  }

  const context = buildSlideContext(lecture.slides);
  if (!hasEnoughText(context)) {
    return NextResponse.json(
      {
        error:
          "There isn't enough extractable text in this deck to generate questions. It may be image-only slides.",
      },
      { status: 422 }
    );
  }

  let raw: string;
  try {
    raw = await generateText(buildExercisePrompt(context), {
      system: STUDY_SYSTEM,
      temperature: 0.5,
    });
  } catch (err) {
    if (err instanceof AINotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "The AI request failed. Please try again." },
      { status: 502 }
    );
  }

  let exercises;
  try {
    exercises = parseExercises(raw);
  } catch (err) {
    if (err instanceof AiParseError) {
      return NextResponse.json(
        {
          error:
            "The AI returned questions we couldn't read. Please try again.",
        },
        { status: 502 }
      );
    }
    throw err;
  }

  // Replace the existing set with the fresh batch so regenerating is clean.
  await prisma.$transaction([
    prisma.exercise.deleteMany({ where: { lectureId: lecture.id } }),
    prisma.exercise.createMany({
      data: exercises.map((e) => ({
        lectureId: lecture.id,
        type: e.type,
        question: e.question,
        answer: e.answer,
        // SQLite has no JSON column: store options as a JSON string (null for short).
        options:
          e.type === "mcq" && e.options ? JSON.stringify(e.options) : null,
      })),
    }),
  ]);

  const created = await prisma.exercise.findMany({
    where: { lectureId: lecture.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ exercises: created });
}
