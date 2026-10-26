import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AINotConfiguredError, generateText } from "@/lib/ai/provider";
import {
  STUDY_SYSTEM,
  buildChatPrompt,
  buildSlideContext,
  hasEnoughText,
  type ChatTurn,
} from "@/lib/ai/prompts";

/** How many prior messages to send back to the model for continuity. */
const HISTORY_LIMIT = 12;

const bodySchema = z.object({
  question: z.string().trim().min(1, "Ask a question first.").max(2000),
});

/**
 * Answer a question about a lecture (the "Understand" chat).
 *
 * Builds a grounded prompt from the lecture slide text plus the recent
 * conversation, calls the AI provider, then persists BOTH the user's question
 * and the assistant's answer as ChatMessage rows. Returns the answer as JSON.
 *
 * Degrades gracefully: AINotConfiguredError becomes a 503 with a clear message.
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

  let question: string;
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      const message =
        parsed.error.flatten().fieldErrors.question?.[0] ??
        "Invalid request.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    question = parsed.data.question;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

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
          "There isn't enough extractable text in this deck to answer questions about it. It may be image-only slides.",
      },
      { status: 422 }
    );
  }

  // Load recent conversation (oldest first) for continuity.
  const priorMessages = await prisma.chatMessage.findMany({
    where: { lectureId: lecture.id, userId: user.id },
    orderBy: { createdAt: "asc" },
    take: HISTORY_LIMIT,
  });
  const history: ChatTurn[] = priorMessages.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  let answer: string;
  try {
    answer = await generateText(buildChatPrompt(context, history, question), {
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

  const content = answer.trim();
  if (!content) {
    return NextResponse.json(
      { error: "The AI returned an empty answer. Please try again." },
      { status: 502 }
    );
  }

  // Persist both turns so the conversation is durable and continuous.
  await prisma.chatMessage.createMany({
    data: [
      { lectureId: lecture.id, userId: user.id, role: "user", content: question },
      {
        lectureId: lecture.id,
        userId: user.id,
        role: "assistant",
        content,
      },
    ],
  });

  return NextResponse.json({ answer: content });
}
