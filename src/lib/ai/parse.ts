/**
 * Robust, zod-validated extraction of JSON from AI model output.
 *
 * Language models are chatty: even when asked for "raw JSON only" they often
 * wrap the answer in a ```json code fence, add a sentence before it, or emit a
 * trailing comma. This module isolates the JSON array from whatever the model
 * returned and validates its SHAPE with zod BEFORE we persist anything, so a
 * malformed or wrong-shaped response is rejected cleanly rather than written to
 * the database.
 *
 * It is pure and does NOT import the AI SDK: callers pass in the raw text.
 */

import { z } from "zod";

/** Thrown when model output cannot be parsed/validated into the expected shape. */
export class AiParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiParseError";
  }
}

/** A validated flashcard: a front prompt and a back answer. */
export const flashcardSchema = z.object({
  front: z.string().trim().min(1),
  back: z.string().trim().min(1),
});
export type ParsedFlashcard = z.infer<typeof flashcardSchema>;

/**
 * A validated exercise. MCQ questions must carry a non-empty options array that
 * contains the answer; short-answer questions carry no options.
 */
export const exerciseSchema = z
  .object({
    type: z.enum(["mcq", "short"]),
    question: z.string().trim().min(1),
    answer: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).optional(),
  })
  .superRefine((ex, ctx) => {
    if (ex.type === "mcq") {
      if (!ex.options || ex.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "mcq questions require at least two options",
          path: ["options"],
        });
        return;
      }
      // The correct answer must appear verbatim among the options.
      if (!ex.options.some((o) => o === ex.answer)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "mcq answer must be one of the options",
          path: ["answer"],
        });
      }
    }
  });
export type ParsedExercise = z.infer<typeof exerciseSchema>;

/**
 * Pull the first balanced JSON array literal out of arbitrary model text.
 *
 * Handles the common cases: a bare array, an array wrapped in a ```json ... ```
 * (or plain ```) code fence, or an array with leading/trailing prose. Returns
 * the substring from the first '[' to its matching ']' (respecting strings and
 * escapes), or null if no array is found.
 */
export function extractJsonArray(raw: string): string | null {
  if (typeof raw !== "string") return null;

  let text = raw.trim();

  // Strip a surrounding Markdown code fence if present, e.g. ```json\n...\n```.
  const fence = text.match(/^```[a-zA-Z0-9]*\s*\n?([\s\S]*?)\n?```$/);
  if (fence) {
    text = fence[1].trim();
  }

  const start = text.indexOf("[");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
    } else if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Parse the raw model output into a JSON array of unknown items, tolerating
 * code fences and surrounding prose. Throws {@link AiParseError} when no valid
 * JSON array can be found.
 */
function parseJsonArray(raw: string): unknown[] {
  const slice = extractJsonArray(raw);
  if (!slice) {
    throw new AiParseError("No JSON array found in the model output.");
  }
  let value: unknown;
  try {
    value = JSON.parse(slice);
  } catch {
    throw new AiParseError("The model output was not valid JSON.");
  }
  if (!Array.isArray(value)) {
    throw new AiParseError("The model output was not a JSON array.");
  }
  return value;
}

/**
 * Validate a raw array of items against a schema, keeping only the valid ones.
 * Throws {@link AiParseError} if NOTHING validates, so callers never persist an
 * empty or entirely-malformed batch.
 */
function validateItems<T>(items: unknown[], schema: z.ZodType<T>): T[] {
  const valid: T[] = [];
  for (const item of items) {
    const parsed = schema.safeParse(item);
    if (parsed.success) {
      valid.push(parsed.data);
    }
  }
  if (valid.length === 0) {
    throw new AiParseError(
      "The model output did not contain any well-formed items."
    );
  }
  return valid;
}

/**
 * Extract and validate flashcards from raw model output.
 * @throws {AiParseError} when the output is unparseable or has no valid cards.
 */
export function parseFlashcards(raw: string): ParsedFlashcard[] {
  return validateItems(parseJsonArray(raw), flashcardSchema);
}

/**
 * Extract and validate exercises from raw model output.
 * @throws {AiParseError} when the output is unparseable or has no valid items.
 */
export function parseExercises(raw: string): ParsedExercise[] {
  return validateItems(parseJsonArray(raw), exerciseSchema);
}
