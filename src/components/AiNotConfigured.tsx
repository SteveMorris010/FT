/**
 * Shown when an AI feature is used but no GEMINI_API_KEY is configured.
 *
 * AI features degrade gracefully: the rest of the app keeps working and the
 * user sees this clear, friendly panel explaining how to enable them instead
 * of a crash or a 500.
 */
export default function AiNotConfigured({
  message,
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6"
    >
      <h2 className="text-lg font-semibold tracking-tight">
        AI features are not configured
      </h2>
      <p className="text-sm leading-relaxed text-foreground/70">
        {message ??
          "This mode uses an AI model to generate study material, but no API key is set yet. Everything else in the app (uploading decks, reading slide text, your library) keeps working without a key."}
      </p>
      <div className="text-sm leading-relaxed text-foreground/70">
        <p className="font-medium text-foreground/80">To enable AI features:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Get a free Gemini API key from Google AI Studio (no credit card
            needed).
          </li>
          <li>
            Add{" "}
            <code className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10">
              GEMINI_API_KEY=your-key
            </code>{" "}
            to your <code className="text-xs">.env</code> file.
          </li>
          <li>Restart the app, then come back to this page.</li>
        </ol>
        <p className="mt-2 text-xs text-foreground/50">
          See the project README for full setup instructions.
        </p>
      </div>
    </div>
  );
}
