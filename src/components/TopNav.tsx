import Link from "next/link";

// The four study modes always operate on a specific lecture, so the top-level
// links point to the library where you pick a lecture first. The per-lecture
// routes live at /lectures/[id]/{summarize,understand,practice,examine}.
const MODES = [
  { href: "/library", label: "Summarize" },
  { href: "/library", label: "Understand" },
  { href: "/library", label: "Practice" },
  { href: "/library", label: "Examine" },
];

/**
 * Clean top navigation shared across the app: brand on the left, the four
 * study modes in the center, and a sign-in link on the right.
 */
export default function TopNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-background/80 backdrop-blur dark:border-white/10">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block h-6 w-6 rounded-md bg-accent"
          />
          <span>FoodTech Study</span>
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          <li>
            <Link
              href="/library"
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
            >
              Library
            </Link>
          </li>
          {MODES.map((mode) => (
            <li key={mode.label}>
              <Link
                href={mode.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-black/5 hover:text-foreground dark:hover:bg-white/10"
              >
                {mode.label}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/login"
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}
