import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AINotConfiguredError,
  DEFAULT_MODEL,
  generateText,
  isAIConfigured,
} from "@/lib/ai/provider";

describe("ai provider", () => {
  const original = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = original;
    }
  });

  it("reports not configured when the key is empty", () => {
    expect(isAIConfigured()).toBe(false);
    process.env.GEMINI_API_KEY = "   ";
    expect(isAIConfigured()).toBe(false);
  });

  it("reports configured when a key is present", () => {
    process.env.GEMINI_API_KEY = "test-key";
    expect(isAIConfigured()).toBe(true);
  });

  it("throws AINotConfiguredError instead of crashing when no key", async () => {
    await expect(generateText("hello")).rejects.toBeInstanceOf(
      AINotConfiguredError
    );
  });

  it("exposes a default model", () => {
    expect(DEFAULT_MODEL).toBe("gemini-2.0-flash");
  });
});
