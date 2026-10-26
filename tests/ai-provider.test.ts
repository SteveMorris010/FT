/**
 * Tests for the AI provider abstraction (src/lib/ai/provider.ts).
 *
 * Two paths are covered:
 *  1. Unconfigured: with GEMINI_API_KEY unset, isAIConfigured() is false and
 *     generateText rejects with AINotConfiguredError (no crash, no network).
 *  2. Configured (mocked): with a key set and @google/genai MOCKED, generateText
 *     passes the composed prompt + options through to the SDK and returns the
 *     model's text. No real network call is made.
 *
 * NOTE: a lightweight smoke test also lives in tests/provider.test.ts (from the
 * scaffold). This file focuses on the mocked-SDK composition path so the two do
 * not conflict.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Capture the args passed to generateContent so we can assert the composition.
const generateContentMock = vi.fn();

// Mock the SDK BEFORE importing the provider. The provider's only dependency on
// the outside world is this module, so mocking it means no network is touched.
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = { generateContent: generateContentMock };
      constructor(public opts: { apiKey: string }) {}
    },
  };
});

import {
  AINotConfiguredError,
  generateText,
  isAIConfigured,
} from "@/lib/ai/provider";

describe("ai provider", () => {
  const original = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    generateContentMock.mockReset();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = original;
    }
  });

  describe("when no key is configured", () => {
    it("reports not configured", () => {
      expect(isAIConfigured()).toBe(false);
      process.env.GEMINI_API_KEY = "   ";
      expect(isAIConfigured()).toBe(false);
    });

    it("rejects with AINotConfiguredError instead of crashing", async () => {
      await expect(generateText("hello")).rejects.toBeInstanceOf(
        AINotConfiguredError
      );
      // The SDK must never be called when there is no key.
      expect(generateContentMock).not.toHaveBeenCalled();
    });
  });

  describe("when a key is configured (SDK mocked)", () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = "test-key";
    });

    it("reports configured", () => {
      expect(isAIConfigured()).toBe(true);
    });

    it("passes the composed prompt and options through and returns model text", async () => {
      generateContentMock.mockResolvedValue({ text: "MODEL ANSWER" });

      const result = await generateText("Summarize this slide text.", {
        system: "You are a Food Technology TA.",
        temperature: 0.3,
      });

      expect(result).toBe("MODEL ANSWER");
      expect(generateContentMock).toHaveBeenCalledTimes(1);

      const callArg = generateContentMock.mock.calls[0][0];
      // The prompt is forwarded verbatim as `contents`.
      expect(callArg.contents).toBe("Summarize this slide text.");
      expect(callArg.model).toBe("gemini-2.0-flash");
      expect(callArg.config.systemInstruction).toBe(
        "You are a Food Technology TA."
      );
      expect(callArg.config.temperature).toBe(0.3);
    });

    it("honours a model override and returns empty string when the SDK yields no text", async () => {
      generateContentMock.mockResolvedValue({ text: undefined });

      const result = await generateText("Hi", { model: "gemini-1.5-pro" });

      expect(result).toBe("");
      const callArg = generateContentMock.mock.calls[0][0];
      expect(callArg.model).toBe("gemini-1.5-pro");
      // No system/temperature passed -> those keys are omitted.
      expect(callArg.config.systemInstruction).toBeUndefined();
      expect(callArg.config.temperature).toBeUndefined();
    });
  });
});
