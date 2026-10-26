import Link from "next/link";

const MODES = [
  {
    title: "Summarize",
    href: "/summarize",
    body: "Turn a lecture deck into a structured, university-level summary you can revise from quickly.",
  },
  {
    title: "Understand",
    href: "/understand",
    body: "Ask questions about a lecture and get precise, terminology-correct explanations grounded in its slides.",
  },
  {
    title: "Practice",
    href: "/practice",
    body: "Generate flashcards and exercises from your material, then drill them at your own pace.",
  },
  {
    title: "Examine",
    href: "/examine",
    body: "Sit a timed exam built from a lecture, get scored, and review detailed per-question feedback.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16">
      {/* Hero */}
      <section className="flex flex-col items-start gap-6 pt-6">
        <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          For Food Technology students
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Study every lecture deeply, not just quickly.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-foreground/70">
          Upload your lecture slides and work through four focused modes built
          for real university coursework. Explanations stay detailed and use
          proper terminology, never dumbed down.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Get started
          </Link>
          <Link
            href="/library"
            className="rounded-md border border-black/10 px-5 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Browse library
          </Link>
        </div>
      </section>

      {/* Modes */}
      <section className="grid gap-4 sm:grid-cols-2">
        {MODES.map((mode) => (
          <Link
            key={mode.href}
            href={mode.href}
            className="group rounded-xl border border-black/10 bg-white/50 p-6 transition-colors hover:border-accent/40 dark:border-white/10 dark:bg-white/5"
          >
            <h2 className="flex items-center justify-between text-lg font-semibold">
              {mode.title}
              <span
                aria-hidden
                className="text-foreground/30 transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
              >
                &rarr;
              </span>
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">
              {mode.body}
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
