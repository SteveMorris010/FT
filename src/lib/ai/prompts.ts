/**
 * Prompt templates for the AI-powered study modes.
 *
 * All prompts share one guiding rule: this is a university Food Technology
 * major studying real course material. The model must be DETAILED, technically
 * precise, and must use correct terminology. It must NOT simplify, dumb down,
 * or "explain like I'm five". Everything must be grounded ONLY in the provided
 * slide text so the model does not invent facts the lecture never covered.
 */

/** Maximum characters of slide context to send the model (keeps prompts sane). */
export const MAX_CONTEXT_CHARS = 24_000;

/**
 * Join a lecture's slides into a single context block the model can read.
 * Slides are labelled so the model can reference them, and empty slides are
 * skipped. The result is truncated to {@link MAX_CONTEXT_CHARS}.
 */
export function buildSlideContext(
  slides: { index: number; text: string }[]
): string {
  const block = slides
    .filter((s) => s.text.trim().length > 0)
    .map((s) => `[Slide ${s.index}]\n${s.text.trim()}`)
    .join("\n\n");
  if (block.length <= MAX_CONTEXT_CHARS) return block;
  return `${block.slice(0, MAX_CONTEXT_CHARS)}\n\n[context truncated]`;
}

/**
 * Returns true when the combined slide text is too short to work with (e.g. an
 * image-only deck). Callers should tell the user rather than ask the model to
 * hallucinate content.
 */
export function hasEnoughText(context: string): boolean {
  return context.trim().length >= 40;
}

/** System instruction shared by both study modes. */
export const STUDY_SYSTEM =
  "You are a rigorous teaching assistant for a university-level Food Technology " +
  "course. Your audience is a second-year Food Technology major, not a layperson. " +
  "Write at university/major level: use correct, domain-specific Food Technology " +
  "and food-science terminology (e.g. water activity, Maillard reaction, D- and " +
  "z-values, rheology, hurdle technology, HTST/UHT, glass transition) and keep full " +
  "technical precision. Do NOT simplify, do NOT dumb down, and do NOT use " +
  "'explain like I'm five' analogies. Ground every statement ONLY in the lecture " +
  "material you are given; if the material does not cover something, say so plainly " +
  "instead of inventing facts.";

/**
 * Build the Summarize prompt. Produces a detailed, structured Markdown summary
 * grounded only in the slide text.
 */
export function buildSummarizePrompt(context: string): string {
  return [
    "Produce a DETAILED, university/major-level study summary of the following",
    "Food Technology lecture material. The summary is for a second-year major who",
    "needs to master this material, so preserve full technical depth and precision.",
    "",
    "Hard requirements:",
    "- Output valid Markdown only (no preamble, no code fences around the whole answer).",
    "- Use clear headings (##) that follow the lecture's structure, with bullet points and short paragraphs.",
    "- Define every key concept precisely using correct Food Technology terminology.",
    "- Explicitly call out important processes, mechanisms, equations, figures, and numeric values (temperatures, pH, water activity, times, etc.) that appear in the material.",
    "- Do NOT simplify or omit technical nuance. Do NOT add facts that are not supported by the material below.",
    "- End with a '## Glossary' section: a short list of the key technical terms used, each with a one-line precise definition.",
    "",
    "Lecture material (the ONLY source you may use):",
    "-----",
    context,
    "-----",
  ].join("\n");
}

/** A single prior turn in the Understand chat. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Build the Understand (Q&A chat) prompt. Grounds the answer in the slide text
 * and the prior conversation, then answers the new question thoroughly.
 */
export function buildChatPrompt(
  context: string,
  history: ChatTurn[],
  question: string
): string {
  const historyBlock =
    history.length > 0
      ? history
          .map(
            (t) =>
              `${t.role === "user" ? "Student" : "Assistant"}: ${t.content}`
          )
          .join("\n\n")
      : "(no previous messages)";

  return [
    "You are answering a Food Technology student's question about a specific lecture.",
    "Answer thoroughly and with full technical accuracy, using correct terminology.",
    "Do NOT simplify or dumb down. Explain mechanisms, reasoning, and relevant",
    "numeric values where the material supports them. Base your answer ONLY on the",
    "lecture material and the conversation so far; if the material does not contain",
    "the answer, say that explicitly and, if helpful, explain what the material does cover.",
    "Format the answer in Markdown.",
    "",
    "Lecture material (the ONLY source you may use):",
    "-----",
    context,
    "-----",
    "",
    "Conversation so far:",
    historyBlock,
    "",
    `New question from the student: ${question}`,
  ].join("\n");
}

/**
 * Build the flashcard-generation prompt.
 *
 * Asks the model for a strict JSON array of {front, back} flashcards covering
 * the key concepts of the lecture. The front is a concise prompt/term/question;
 * the back is a precise, university-level answer using correct terminology.
 * The output is parsed and validated by {@link parseFlashcards} before any row
 * is persisted, so we insist on raw JSON with no prose or code fences.
 */
export function buildFlashcardPrompt(context: string, count = 12): string {
  return [
    `Create up to ${count} study flashcards from the following Food Technology`,
    "lecture material. Each flashcard must test one important concept, term,",
    "process, mechanism, or numeric value that actually appears in the material.",
    "",
    "Flashcard quality rules:",
    "- The 'front' is a concise prompt: a term to define, a question, or 'What is ...?'.",
    "- The 'back' is a precise, university/major-level answer using correct Food",
    "  Technology terminology. Do NOT simplify or dumb down. Keep each back focused",
    "  (roughly 1-3 sentences) but technically complete.",
    "- Cover the material broadly; do not create near-duplicate cards.",
    "- Base every card ONLY on the material below. Do not invent facts.",
    "",
    "Output format (STRICT):",
    "- Return ONLY a JSON array. No prose, no explanation, no Markdown code fences.",
    '- Each element is an object with exactly two string keys: "front" and "back".',
    '- Example: [{"front":"What is water activity (aw)?","back":"..."}]',
    "",
    "Lecture material (the ONLY source you may use):",
    "-----",
    context,
    "-----",
  ].join("\n");
}

/**
 * Build the exercise/question-generation prompt.
 *
 * Asks the model for a strict JSON array of practice questions: multiple-choice
 * (`type:"mcq"` with an `options` array including the correct answer) and
 * short-answer (`type:"short"`). The output is parsed and validated by
 * {@link parseExercises} before persisting.
 */
export function buildExercisePrompt(context: string, count = 10): string {
  return [
    `Create up to ${count} practice exam questions from the following Food`,
    "Technology lecture material. Mix multiple-choice and short-answer questions.",
    "",
    "Question quality rules:",
    "- Test genuine understanding of concepts, processes, mechanisms, and numeric",
    "  values that appear in the material, at university/major level. Do NOT dumb down.",
    "- Multiple-choice questions ('mcq'): provide 3-5 plausible 'options' and set",
    "  'answer' to EXACTLY one of those option strings (verbatim).",
    "- Short-answer questions ('short'): 'answer' is a concise correct answer (a term,",
    "  short phrase, or value) that can be matched case-insensitively. Omit 'options'.",
    "- Base every question and answer ONLY on the material below. Do not invent facts.",
    "",
    "Output format (STRICT):",
    "- Return ONLY a JSON array. No prose, no explanation, no Markdown code fences.",
    "- Each element is an object with keys:",
    '    "type": "mcq" or "short",',
    '    "question": string,',
    '    "answer": string,',
    '    "options": array of strings (REQUIRED for mcq, omit for short).',
    '- Example: [{"type":"mcq","question":"...","answer":"HTST","options":["HTST","UHT","LTLT","Batch"]},',
    '            {"type":"short","question":"Define the z-value.","answer":"..."}]',
    "",
    "Lecture material (the ONLY source you may use):",
    "-----",
    context,
    "-----",
  ].join("\n");
}
