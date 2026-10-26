import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";
import { AINotConfiguredError, generateText } from "@/lib/ai/provider";
import {
  STUDY_SYSTEM,
  buildFlashcardPrompt,
  buildSlideContext,
  hasEnoughText,
} from "@/lib/ai/prompts";
import { AiParseError, parseFlashcards } from "@/lib/ai/parse";

/**
 * Generate flashcards for a lecture with the AI provider.
 *
 * Loads the lecture slide text, asks the model for a JSON array of
 * {front, back} cards, validates the shape BEFORE persisting (so malformed
 * output never reaches the DB), then replaces the lecture's flashcards with the
 * fresh batch. Returns the created cards as JSON.
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
    where: lectureOwnershipWhere(id, user.id),
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
          "There isn't enough extractable text in this deck to generate flashcards. It may be image-only slides.",
      },
      { status: 422 }
    );
  }

  let raw: string;
  try {
    raw = await generateText(buildFlashcardPrompt(context), {
      system: STUDY_SYSTEM,
      temperature: 0.4,
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

  let cards;
  try {
    cards = parseFlashcards(raw);
  } catch (err) {
    if (err instanceof AiParseError) {
      return NextResponse.json(
        {
          error:
            "The AI returned flashcards we couldn't read. Please try again.",
        },
        { status: 502 }
      );
    }
    throw err;
  }

  // Replace the existing deck with the fresh batch so regenerating is clean.
  await prisma.$transaction([
    prisma.flashcard.deleteMany({ where: { lectureId: lecture.id } }),
    prisma.flashcard.createMany({
      data: cards.map((c) => ({
        lectureId: lecture.id,
        front: c.front,
        back: c.back,
      })),
    }),
  ]);

  const flashcards = await prisma.flashcard.findMany({
    where: { lectureId: lecture.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ flashcards });
}
