import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";
import { AINotConfiguredError, generateText } from "@/lib/ai/provider";
import {
  STUDY_SYSTEM,
  buildSlideContext,
  buildSummarizePrompt,
  hasEnoughText,
} from "@/lib/ai/prompts";

/**
 * Generate (or regenerate) the summary for a lecture.
 *
 * Loads the lecture's slide text, asks the AI provider for a detailed
 * university-level Markdown summary, and upserts it into the Summary table
 * (one per lecture). Returns the stored markdown as JSON.
 *
 * Degrades gracefully: when no API key is configured the provider throws
 * AINotConfiguredError, which we turn into a 503 with a clear JSON message so
 * the UI can show the "AI not configured" panel instead of crashing.
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
          "There isn't enough extractable text in this deck to summarize. It may be image-only slides.",
      },
      { status: 422 }
    );
  }

  let markdown: string;
  try {
    markdown = await generateText(buildSummarizePrompt(context), {
      system: STUDY_SYSTEM,
      temperature: 0.3,
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

  const content = markdown.trim();
  if (!content) {
    return NextResponse.json(
      { error: "The AI returned an empty summary. Please try again." },
      { status: 502 }
    );
  }

  const summary = await prisma.summary.upsert({
    where: { lectureId: lecture.id },
    create: { lectureId: lecture.id, content },
    update: { content },
  });

  return NextResponse.json({ content: summary.content });
}
