import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";

export const metadata = { title: "Lecture - FoodTech Study" };

const MODES = [
  { slug: "summarize", label: "Summarize" },
  { slug: "understand", label: "Understand" },
  { slug: "practice", label: "Practice" },
  { slug: "examine", label: "Examine" },
] as const;

export default async function LecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  // Scope the lookup to the current user via the subject relation so users
  // cannot read each other's lectures.
  const lecture = await prisma.lecture.findFirst({
    where: lectureOwnershipWhere(id, user.id),
    include: {
      subject: { select: { name: true } },
      slides: { orderBy: { index: "asc" } },
    },
  });

  if (!lecture) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link
          href="/library"
          className="text-sm text-foreground/50 transition-colors hover:text-accent"
        >
          &larr; {lecture.subject.name}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">
          {lecture.title}
        </h1>
        <p className="text-sm text-foreground/60">
          {lecture.slideCount}{" "}
          {lecture.slideCount === 1 ? "slide" : "slides"} &middot;{" "}
          {lecture.originalFileName}
        </p>
      </div>

      {/* Mode navigation. These routes arrive in later features; for now they
          may 404 or show placeholders. */}
      <nav className="flex flex-wrap gap-2">
        {MODES.map((mode) => (
          <Link
            key={mode.slug}
            href={`/lectures/${lecture.id}/${mode.slug}`}
            className="rounded-md border border-black/10 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-accent/40 hover:text-accent dark:border-white/15"
          >
            {mode.label}
          </Link>
        ))}
      </nav>

      {/* Extracted slide text, collapsible per slide. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Slide text</h2>
        {lecture.slides.length === 0 ? (
          <p className="text-sm text-foreground/60">
            No slide text was extracted from this deck.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {lecture.slides.map((slide) => (
              <details
                key={slide.id}
                className="group rounded-lg border border-black/10 bg-white/50 p-0 dark:border-white/10 dark:bg-white/5"
              >
                <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-medium">
                  <span>Slide {slide.index}</span>
                  <span
                    aria-hidden
                    className="text-foreground/40 transition-transform group-open:rotate-90"
                  >
                    &rsaquo;
                  </span>
                </summary>
                <div className="border-t border-black/5 px-4 py-3 text-sm leading-relaxed text-foreground/80 dark:border-white/10">
                  {slide.text ? (
                    slide.text
                  ) : (
                    <span className="italic text-foreground/40">
                      (no text on this slide)
                    </span>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
