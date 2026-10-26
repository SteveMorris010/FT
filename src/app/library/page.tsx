import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createSubject } from "./actions";

export const metadata = { title: "Library - FoodTech Study" };

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { error } = await searchParams;

  const subjects = await prisma.subject.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: {
      lectures: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, slideCount: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-foreground/60">
            Organize your courses and upload lecture decks to study.
          </p>
        </div>
        <form method="post" action="/api/auth/logout">
          <button
            type="submit"
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm text-foreground/70 transition-colors hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
          >
            Sign out
          </button>
        </form>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}

      {/* Create a subject */}
      <section className="rounded-xl border border-black/10 bg-white/50 p-5 dark:border-white/10 dark:bg-white/5">
        <h2 className="text-sm font-semibold">New subject</h2>
        <form
          action={createSubject}
          className="mt-3 flex flex-wrap items-center gap-3"
        >
          <input
            type="text"
            name="name"
            required
            placeholder="e.g. Food Chemistry"
            className="min-w-56 flex-1 rounded-md border border-black/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/15 dark:bg-white/5"
          />
          <button
            type="submit"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            Add subject
          </button>
        </form>
      </section>

      {/* Subjects + lectures */}
      {subjects.length === 0 ? (
        <p className="text-sm text-foreground/60">
          No subjects yet. Create one above to get started.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {subjects.map((subject) => (
            <section key={subject.id} className="flex flex-col gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                {subject.name}
              </h2>

              {subject.lectures.length === 0 ? (
                <p className="text-sm text-foreground/50">
                  No lectures yet.
                </p>
              ) : (
                <ul className="grid gap-3 sm:grid-cols-2">
                  {subject.lectures.map((lecture) => (
                    <li key={lecture.id}>
                      <Link
                        href={`/lectures/${lecture.id}`}
                        className="group flex flex-col rounded-lg border border-black/10 bg-white/50 p-4 transition-colors hover:border-accent/40 dark:border-white/10 dark:bg-white/5"
                      >
                        <span className="font-medium">{lecture.title}</span>
                        <span className="mt-1 text-xs text-foreground/50">
                          {lecture.slideCount}{" "}
                          {lecture.slideCount === 1 ? "slide" : "slides"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {/* Upload a lecture into this subject */}
              <form
                method="post"
                action="/api/lectures/upload"
                encType="multipart/form-data"
                className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-black/15 p-4 dark:border-white/15"
              >
                <input type="hidden" name="subjectId" value={subject.id} />
                <input
                  type="text"
                  name="title"
                  placeholder="Lecture title (optional)"
                  className="min-w-48 flex-1 rounded-md border border-black/15 bg-white/70 px-3 py-2 text-sm outline-none focus:border-accent dark:border-white/15 dark:bg-white/5"
                />
                <input
                  type="file"
                  name="file"
                  accept=".pptx"
                  required
                  className="flex-1 text-sm text-foreground/70 file:mr-3 file:rounded-md file:border-0 file:bg-black/5 file:px-3 file:py-2 file:text-sm file:font-medium hover:file:bg-black/10 dark:file:bg-white/10 dark:hover:file:bg-white/15"
                />
                <button
                  type="submit"
                  className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  Upload .pptx
                </button>
              </form>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
