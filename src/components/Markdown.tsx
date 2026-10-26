/**
 * Render a Markdown string as sanitized HTML.
 *
 * AI-generated content is never trusted raw: we run it through
 * `rehype-sanitize` (default GitHub-flavored allowlist) so no script tags,
 * event handlers, or dangerous URLs can slip through. `remark-gfm` adds tables,
 * strikethrough, and task lists. Styling is plain Tailwind utility classes so
 * we don't depend on a typography plugin.
 */
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export default function Markdown({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed text-foreground/85">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          h1: (props) => (
            <h1 className="mt-2 text-2xl font-semibold tracking-tight" {...props} />
          ),
          h2: (props) => (
            <h2 className="mt-4 text-xl font-semibold tracking-tight" {...props} />
          ),
          h3: (props) => (
            <h3 className="mt-3 text-lg font-semibold tracking-tight" {...props} />
          ),
          p: (props) => <p className="leading-relaxed" {...props} />,
          ul: (props) => (
            <ul className="list-disc space-y-1 pl-5" {...props} />
          ),
          ol: (props) => (
            <ol className="list-decimal space-y-1 pl-5" {...props} />
          ),
          li: (props) => <li className="leading-relaxed" {...props} />,
          code: (props) => (
            <code
              className="rounded bg-black/10 px-1 py-0.5 text-xs dark:bg-white/10"
              {...props}
            />
          ),
          pre: (props) => (
            <pre
              className="overflow-x-auto rounded-lg bg-black/5 p-3 text-xs dark:bg-white/10"
              {...props}
            />
          ),
          table: (props) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left" {...props} />
            </div>
          ),
          th: (props) => (
            <th
              className="border border-black/10 px-3 py-1.5 font-medium dark:border-white/15"
              {...props}
            />
          ),
          td: (props) => (
            <td
              className="border border-black/10 px-3 py-1.5 dark:border-white/15"
              {...props}
            />
          ),
          a: (props) => (
            <a
              className="text-accent underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
              {...props}
            />
          ),
          blockquote: (props) => (
            <blockquote
              className="border-l-2 border-accent/40 pl-3 text-foreground/70"
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
