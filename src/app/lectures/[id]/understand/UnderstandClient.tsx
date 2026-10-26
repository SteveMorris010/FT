"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "@/components/Markdown";
import AiNotConfigured from "@/components/AiNotConfigured";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/**
 * Client chat UI for the Understand mode.
 *
 * Renders the stored conversation and an input box. On submit it POSTs the
 * question to the chat route; the server persists both turns and returns the
 * answer. A 503 (no API key) swaps in the AiNotConfigured panel.
 */
export default function UnderstandClient({
  lectureId,
  initialMessages,
}: {
  lectureId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setError(null);
    setNotConfigured(false);
    setLoading(true);
    // Optimistically show the user's message.
    const optimistic: Message = {
      id: `local-${Date.now()}`,
      role: "user",
      content: question,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");

    try {
      const res = await fetch(`/api/lectures/${lectureId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 503) {
        setNotConfigured(true);
        // Roll back the optimistic message.
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Could not get an answer.");
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
        setInput(question);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.answer ?? "",
        },
      ]);
    } catch {
      setError("Network error. Please try again.");
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(question);
    } finally {
      setLoading(false);
    }
  }

  if (notConfigured) {
    return <AiNotConfigured />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-h-64 flex-col gap-4 rounded-xl border border-black/10 bg-white/50 p-5 dark:border-white/10 dark:bg-white/5">
        {messages.length === 0 && !loading ? (
          <p className="text-sm text-foreground/50">
            Ask anything about this lecture. Answers are grounded in the slide
            text and kept at university level.
          </p>
        ) : null}

        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "flex flex-col items-end gap-1"
                : "flex flex-col items-start gap-1"
            }
          >
            <span className="text-xs font-medium text-foreground/40">
              {m.role === "user" ? "You" : "Assistant"}
            </span>
            {m.role === "user" ? (
              <p className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-accent px-3 py-2 text-sm text-white">
                {m.content}
              </p>
            ) : (
              <div className="max-w-[90%] rounded-lg border border-black/10 bg-background px-4 py-3 dark:border-white/10">
                <Markdown content={m.content} />
              </div>
            )}
          </div>
        ))}

        {loading ? (
          <p className="text-sm text-foreground/50">Thinking...</p>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}

      <form onSubmit={send} className="flex items-end gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          rows={2}
          placeholder="Ask a question about this lecture..."
          className="flex-1 resize-none rounded-md border border-black/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/15 dark:bg-white/5"
        />
        <button
          type="submit"
          disabled={loading || input.trim().length === 0}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
