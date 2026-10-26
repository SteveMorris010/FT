import { describe, it, expect } from "vitest";
import {
  AiParseError,
  extractJsonArray,
  parseExercises,
  parseFlashcards,
} from "@/lib/ai/parse";

describe("extractJsonArray", () => {
  it("returns a bare JSON array unchanged", () => {
    const raw = '[{"a":1}]';
    expect(extractJsonArray(raw)).toBe('[{"a":1}]');
  });

  it("strips a ```json code fence", () => {
    const raw = '```json\n[{"front":"a","back":"b"}]\n```';
    expect(extractJsonArray(raw)).toBe('[{"front":"a","back":"b"}]');
  });

  it("strips a plain ``` code fence", () => {
    const raw = '```\n[1,2,3]\n```';
    expect(extractJsonArray(raw)).toBe("[1,2,3]");
  });

  it("extracts an array embedded in surrounding prose", () => {
    const raw = 'Sure! Here are your cards:\n[{"x":1}]\nHope that helps.';
    expect(extractJsonArray(raw)).toBe('[{"x":1}]');
  });

  it("respects brackets inside string values", () => {
    const raw = '[{"front":"array [a] notation","back":"ok"}]';
    expect(extractJsonArray(raw)).toBe(
      '[{"front":"array [a] notation","back":"ok"}]'
    );
  });

  it("returns null when there is no array", () => {
    expect(extractJsonArray("no json here")).toBeNull();
  });
});

describe("parseFlashcards", () => {
  it("parses valid flashcards, tolerating a code fence", () => {
    const raw =
      '```json\n[{"front":"What is aw?","back":"Water activity."},' +
      '{"front":"z-value?","back":"Temperature change for a 10x change in D."}]\n```';
    const cards = parseFlashcards(raw);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({
      front: "What is aw?",
      back: "Water activity.",
    });
  });

  it("drops malformed cards but keeps valid ones", () => {
    const raw =
      '[{"front":"ok","back":"good"},{"front":"","back":"missing front"},{"foo":"bar"}]';
    const cards = parseFlashcards(raw);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe("ok");
  });

  it("throws AiParseError on non-array JSON", () => {
    expect(() => parseFlashcards('{"front":"a","back":"b"}')).toThrow(
      AiParseError
    );
  });

  it("throws AiParseError when no valid card exists", () => {
    expect(() => parseFlashcards('[{"foo":"bar"}]')).toThrow(AiParseError);
  });

  it("throws AiParseError on invalid JSON", () => {
    expect(() => parseFlashcards("not json at all")).toThrow(AiParseError);
  });
});

describe("parseExercises", () => {
  it("parses a mix of mcq and short questions", () => {
    const raw = JSON.stringify([
      {
        type: "mcq",
        question: "Which is a continuous-flow pasteurization method?",
        answer: "HTST",
        options: ["HTST", "Batch", "LTLT"],
      },
      { type: "short", question: "Define the z-value.", answer: "..." },
    ]);
    const exercises = parseExercises(raw);
    expect(exercises).toHaveLength(2);
    expect(exercises[0].type).toBe("mcq");
    expect(exercises[0].options).toEqual(["HTST", "Batch", "LTLT"]);
    expect(exercises[1].type).toBe("short");
  });

  it("rejects an mcq whose answer is not among its options", () => {
    const raw = JSON.stringify([
      { type: "mcq", question: "q", answer: "UHT", options: ["HTST", "Batch"] },
    ]);
    expect(() => parseExercises(raw)).toThrow(AiParseError);
  });

  it("rejects an mcq with fewer than two options", () => {
    const raw = JSON.stringify([
      { type: "mcq", question: "q", answer: "HTST", options: ["HTST"] },
    ]);
    expect(() => parseExercises(raw)).toThrow(AiParseError);
  });

  it("rejects an unknown question type", () => {
    const raw = JSON.stringify([
      { type: "essay", question: "q", answer: "a" },
    ]);
    expect(() => parseExercises(raw)).toThrow(AiParseError);
  });

  it("keeps a valid short question while dropping an invalid mcq", () => {
    const raw = JSON.stringify([
      { type: "mcq", question: "bad", answer: "Z", options: ["A", "B"] },
      { type: "short", question: "good", answer: "water activity" },
    ]);
    const exercises = parseExercises(raw);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].question).toBe("good");
  });
});
