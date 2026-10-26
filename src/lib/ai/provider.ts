/**
 * Pluggable AI provider abstraction.
 *
 * This is the ONLY file in the codebase that imports the AI SDK. Every other
 * module must call the functions exported here. That keeps provider details
 * (and the "is a key configured?" check) in exactly one place, so the rest of
 * the app never crashes when no API key is present.
 *
 * Default provider: Google Gemini via @google/genai. Gemini has a genuine free
 * tier (Google AI Studio, no credit card), which is why it is the default.
 */

import { GoogleGenAI } from "@google/genai";

/** Default Gemini model. Fast and available on the free tier. */
export const DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Thrown by AI functions when no API key is configured. Callers should catch
 * this and show a friendly "AI not configured" message instead of a 500.
 */
export class AINotConfiguredError extends Error {
  constructor(
    message = "AI features are not configured. Set GEMINI_API_KEY in your .env to enable them."
  ) {
    super(message);
    this.name = "AINotConfiguredError";
  }
}

/** Options accepted by {@link generateText}. */
export interface GenerateTextOptions {
  /** Optional system instruction to steer the model. */
  system?: string;
  /** Override the model for this call. */
  model?: string;
  /** Sampling temperature (0..2). */
  temperature?: number;
}

function getApiKey(): string {
  return (process.env.GEMINI_API_KEY ?? "").trim();
}

function getModel(override?: string): string {
  return (
    override ||
    (process.env.GEMINI_MODEL ?? "").trim() ||
    DEFAULT_MODEL
  );
}

/**
 * Returns true when an AI API key is configured. Safe to call anywhere
 * (server components, route handlers) to decide whether to offer AI features.
 */
export function isAIConfigured(): boolean {
  return getApiKey().length > 0;
}

// Lazily construct and reuse the client so we don't allocate one per call.
let cachedClient: GoogleGenAI | null = null;
let cachedKey: string | null = null;

function getClient(): GoogleGenAI {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new AINotConfiguredError();
  }
  if (!cachedClient || cachedKey !== apiKey) {
    cachedClient = new GoogleGenAI({ apiKey });
    cachedKey = apiKey;
  }
  return cachedClient;
}

/**
 * Generate text from a prompt using the configured provider.
 *
 * @throws {AINotConfiguredError} when no API key is configured.
 */
export async function generateText(
  prompt: string,
  opts: GenerateTextOptions = {}
): Promise<string> {
  const client = getClient();
  const model = getModel(opts.model);

  const response = await client.models.generateContent({
    model,
    contents: prompt,
    config: {
      ...(opts.system ? { systemInstruction: opts.system } : {}),
      ...(opts.temperature !== undefined
        ? { temperature: opts.temperature }
        : {}),
    },
  });

  // `text` is a convenience accessor on the SDK response for the concatenated
  // text of the first candidate.
  return response.text ?? "";
}
