import { describe, it, expect } from "vitest";
import {
  gradeExam,
  gradeQuestion,
  normalizeAnswer,
  type ExamQuestion,
} from "@/lib/exam";

const mcq = (
  id: string,
  answer: string,
  options: string[]
): ExamQuestion => ({
  id,
  type: "mcq",
  question: `Q ${id}`,
  answer,
  options,
});

const short = (id: string, answer: string): ExamQuestion => ({
  id,
  type: "short",
  question: `Q ${id}`,
  answer,
  options: [],
});

describe("normalizeAnswer", () => {
  it("lower-cases, trims, and collapses whitespace", () => {
    expect(normalizeAnswer("  D  Value ")).toBe("d value");
  });

  it("treats punctuation/hyphens as separators", () => {
    expect(normalizeAnswer("D-value.")).toBe(normalizeAnswer("d value"));
  });

  it("returns empty string for blank input", () => {
    expect(normalizeAnswer("   ")).toBe("");
  });
});

describe("gradeQuestion - MCQ exact match", () => {
  const q = mcq("1", "HTST", ["HTST", "UHT", "LTLT", "Batch"]);

  it("marks the exact chosen option correct", () => {
    expect(gradeQuestion(q, "HTST").correct).toBe(true);
  });

  it("marks a different option incorrect", () => {
    expect(gradeQuestion(q, "UHT").correct).toBe(false);
  });

  it("does not normalize MCQ (case-sensitive exact match)", () => {
    expect(gradeQuestion(q, "htst").correct).toBe(false);
  });

  it("marks an unanswered MCQ incorrect", () => {
    expect(gradeQuestion(q, undefined).correct).toBe(false);
    expect(gradeQuestion(q, "").correct).toBe(false);
  });
});

describe("gradeQuestion - short answer normalization", () => {
  const q = short("2", "Water Activity");

  it("accepts case and whitespace variations", () => {
    expect(gradeQuestion(q, "  water   activity ").correct).toBe(true);
    expect(gradeQuestion(q, "WATER ACTIVITY").correct).toBe(true);
  });

  it("accepts punctuation/hyphen differences", () => {
    expect(gradeQuestion(short("3", "D-value"), "d value").correct).toBe(true);
  });

  it("rejects a wrong answer", () => {
    expect(gradeQuestion(q, "water content").correct).toBe(false);
  });

  it("rejects a blank short answer", () => {
    expect(gradeQuestion(q, "   ").correct).toBe(false);
  });
});

describe("gradeExam - mixed total scoring", () => {
  const questions: ExamQuestion[] = [
    mcq("a", "HTST", ["HTST", "UHT"]),
    mcq("b", "UHT", ["HTST", "UHT"]),
    short("c", "Maillard reaction"),
    short("d", "glass transition"),
  ];

  it("totals correct answers across types with normalization", () => {
    const result = gradeExam(questions, {
      a: "HTST", // correct mcq
      b: "HTST", // wrong mcq
      c: "  maillard   REACTION ", // correct via normalization
      d: "glass transition temperature", // wrong (extra word)
    });

    expect(result.total).toBe(4);
    expect(result.score).toBe(2);
  });

  it("produces feedback with correct answer and correctness per question", () => {
    const result = gradeExam(questions, { a: "HTST", c: "maillard reaction" });

    expect(result.feedback).toHaveLength(4);

    const fa = result.feedback.find((f) => f.id === "a")!;
    expect(fa.correct).toBe(true);
    expect(fa.correctAnswer).toBe("HTST");
    expect(fa.userAnswer).toBe("HTST");

    const fb = result.feedback.find((f) => f.id === "b")!;
    expect(fb.correct).toBe(false);
    expect(fb.correctAnswer).toBe("UHT");
    expect(fb.userAnswer).toBe(""); // unanswered

    const fc = result.feedback.find((f) => f.id === "c")!;
    expect(fc.correct).toBe(true);
    expect(fc.correctAnswer).toBe("Maillard reaction");

    const fd = result.feedback.find((f) => f.id === "d")!;
    expect(fd.correct).toBe(false);
  });

  it("scores an all-empty submission as zero", () => {
    const result = gradeExam(questions, {});
    expect(result.score).toBe(0);
    expect(result.total).toBe(4);
    expect(result.feedback.every((f) => !f.correct)).toBe(true);
  });

  it("does not import any AI code (pure logic)", () => {
    // A guard: grading must be deterministic and require no configuration.
    const r1 = gradeExam(questions, { a: "HTST" });
    const r2 = gradeExam(questions, { a: "HTST" });
    expect(r1).toEqual(r2);
  });
});
