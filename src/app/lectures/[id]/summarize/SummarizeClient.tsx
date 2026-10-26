"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "@/components/Markdown";
import AiNotConfigured from "@/components/AiNotConfigured";

/**
 * Client UI for the Summarize mode.
 *
 * Shows the stored summary (if any) as sanitized Markdown with a
 * Generate/Regenerate button. On click it POSTs to the summarize route; a 503
 * (no API key) swaps the view for the AiNotConfigured panel instead of showing
 * a scary error.
 */
export default function SummarizeClient({
  lectureId,
  initialContent,
}: {
  lectureId: string;
  initialContent: string | null;
}) {
  const router = useRouter();
  const [content, setContent] = useState<string | null>(initialContent);
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const res = await fetch(`/api/lectures/${lectureId}/summarize`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 503) {
        setNotConfigured(true);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not generate a summary.");
        return;
      }
      setContent(data.content ?? "");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (notConfigured) {
    return <AiNotConfigured />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {loading
            ? "Generating..."
            : content
            ? "Regenerate summary"
            : "Generate summary"}
        </button>
        {loading ? (
          <span className="text-sm text-foreground/50">
            Writing a detailed, university-level summary...
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}

      {content ? (
        <article className="rounded-xl border border-black/10 bg-white/50 p-6 dark:border-white/10 dark:bg-white/5">
          <Markdown content={content} />
        </article>
      ) : !loading ? (
        <p className="text-sm text-foreground/60">
          No summary yet. Generate one to get a structured, detailed overview of
          this lecture.
        </p>
      ) : null}
    </div>
  );
}
