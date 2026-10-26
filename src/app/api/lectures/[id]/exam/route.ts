import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";
import { gradeExam, type ExamQuestion } from "@/lib/exam";

/**
 * Submit a completed exam attempt.
 *
 * This endpoint is PURE non-AI: it re-grades the submitted answers on the
 * server against the stored exercises (so scoring cannot be tampered with from
 * the client), persists an ExamAttempt with the score and a JSON detail
 * breakdown, and returns the authoritative result. It works with no API key.
 *
 * The client sends the exact subset of question ids that were on the exam
 * (exams can be a random subset of the lecture's questions) plus the answers.
 */
const bodySchema = z.object({
  // Question ids included in this exam, in presentation order.
  questionIds: z.array(z.string().min(1)).min(1).max(200),
  // Map of questionId -> the student's raw answer.
  answers: z.record(z.string(), z.string()),
  // Elapsed time in seconds (clamped server-side to a sane range).
  durationSeconds: z.number().int().min(0).max(24 * 60 * 60),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await params;

  let body: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const lecture = await prisma.lecture.findFirst({
    where: lectureOwnershipWhere(id, user.id),
    select: { id: true },
  });
  if (!lecture) {
    return NextResponse.json({ error: "Lecture not found." }, { status: 404 });
  }

  // Load exactly the exercises that were on this exam, scoped to the lecture so
  // a client cannot smuggle in questions from another lecture.
  const rows = await prisma.exercise.findMany({
    where: { id: { in: body.questionIds }, lectureId: lecture.id },
  });
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "None of the submitted questions belong to this lecture." },
      { status: 400 }
    );
  }

  // Grading runs over stored exercises by id. If the lecture's exercises were
  // regenerated while this exam was open (regenerate deletes and recreates the
  // rows), some submitted ids no longer exist and would be silently dropped
  // from grading. Detect that and report it so the UI can warn the student
  // their score was computed over fewer questions than they sat.
  const missingCount = body.questionIds.length - rows.length;

  // Preserve the client's presentation order where possible.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const questions: ExamQuestion[] = body.questionIds
    .map((qid) => byId.get(qid))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .map((r) => ({
      id: r.id,
      type: r.type === "mcq" ? "mcq" : "short",
      question: r.question,
      answer: r.answer,
      options: decodeOptions(r.options),
    }));

  // PURE scoring: re-grade on the server.
  const result = gradeExam(questions, body.answers);

  const attempt = await prisma.examAttempt.create({
    data: {
      userId: user.id,
      lectureId: lecture.id,
      score: result.score,
      totalQuestions: result.total,
      durationSeconds: body.durationSeconds,
      detail: JSON.stringify(result.feedback),
    },
  });

  return NextResponse.json({
    attemptId: attempt.id,
    score: result.score,
    total: result.total,
    feedback: result.feedback,
    // Number of questions that were on the exam but no longer exist (e.g. the
    // question set was regenerated mid-exam). 0 in the normal case.
    missingCount,
  });
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
