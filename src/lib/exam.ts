/**
 * Exam scoring - PURE, offline logic.
 *
 * This module deliberately imports NOTHING from the AI provider. Grading an
 * exam is deterministic: compare the student's answer to the stored correct
 * answer. It therefore works fully without any API key, as long as exercises
 * already exist for the lecture.
 *
 * Scoring rules:
 * - MCQ: exact-match of the chosen option against the stored answer.
 * - Short answer: normalized comparison (trimmed, lower-cased, inner
 *   whitespace and most punctuation collapsed) so trivial formatting
 *   differences ("D-value" vs "d value") do not cost the student a mark.
 */

/** The shape of a gradable question. Mirrors the stored Exercise, decoded. */
export interface ExamQuestion {
  id: string;
  type: "mcq" | "short";
  question: string;
  answer: string;
  /** Decoded MCQ options (empty for short-answer). */
  options: string[];
}

/** Per-question grading outcome shown back to the student as feedback. */
export interface QuestionFeedback {
  id: string;
  type: "mcq" | "short";
  question: string;
  /** The raw answer the student submitted (empty string if unanswered). */
  userAnswer: string;
  /** The stored correct answer. */
  correctAnswer: string;
  /** Whether the student's answer was graded correct. */
  correct: boolean;
}

/** The result of grading a whole exam. */
export interface ExamResult {
  /** Number of questions answered correctly. */
  score: number;
  /** Total number of questions graded. */
  total: number;
  /** Per-question feedback, in the same order as the input questions. */
  feedback: QuestionFeedback[];
}

/**
 * Normalize a short answer for lenient comparison.
 *
 * Lower-cases, trims, collapses internal whitespace to single spaces, and
 * removes most punctuation so that "D value.", "D-value", and "d  value" all
 * compare equal. Alphanumerics (including Unicode letters) are preserved.
 */
export function normalizeAnswer(value: string): string {
  return (value ?? "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    // Replace any run of non-alphanumeric characters with a single space.
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Grade a single question given the student's raw answer.
 *
 * MCQ is compared exactly (the UI submits the chosen option verbatim). Short
 * answer is compared after {@link normalizeAnswer}. An empty/undefined answer
 * is always incorrect.
 */
export function gradeQuestion(
  question: ExamQuestion,
  userAnswer: string | undefined | null
): QuestionFeedback {
  const raw = (userAnswer ?? "").toString();

  let correct: boolean;
  if (question.type === "mcq") {
    // Exact match on the chosen option. Treat an unanswered question as wrong.
    correct = raw.length > 0 && raw === question.answer;
  } else {
    const normUser = normalizeAnswer(raw);
    correct =
      normUser.length > 0 && normUser === normalizeAnswer(question.answer);
  }

  return {
    id: question.id,
    type: question.type,
    question: question.question,
    userAnswer: raw,
    correctAnswer: question.answer,
    correct,
  };
}

/**
 * Grade an exam: a list of questions plus a map of questionId -> answer.
 * Returns the total score and per-question feedback. Pure and deterministic.
 */
export function gradeExam(
  questions: ExamQuestion[],
  answers: Record<string, string>
): ExamResult {
  const feedback = questions.map((q) => gradeQuestion(q, answers[q.id]));
  const score = feedback.reduce((acc, f) => acc + (f.correct ? 1 : 0), 0);
  return {
    score,
    total: questions.length,
    feedback,
  };
}
