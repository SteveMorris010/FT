import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";
import { isAIConfigured } from "@/lib/ai/provider";
import { buildSlideContext, hasEnoughText } from "@/lib/ai/prompts";
import AiNotConfigured from "@/components/AiNotConfigured";
import SummarizeClient from "./SummarizeClient";

export const metadata = { title: "Summarize - FoodTech Study" };

export default async function SummarizePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const lecture = await prisma.lecture.findFirst({
    where: lectureOwnershipWhere(id, user.id),
    include: {
      summary: true,
      slides: { orderBy: { index: "asc" } },
    },
  });

  if (!lecture) notFound();

  const configured = isAIConfigured();
  const context = buildSlideContext(lecture.slides);
  const enoughText = hasEnoughText(context);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/lectures/${lecture.id}`}
          className="text-sm text-foreground/50 transition-colors hover:text-accent"
        >
          &larr; {lecture.title}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Summarize</h1>
        <p className="text-sm text-foreground/60">
          A detailed, university-level summary of this lecture using correct Food
          Technology terminology.
        </p>
      </div>

      {!enoughText ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground/70">
          There isn&apos;t enough extractable text in this deck to summarize. The
          slides may be image-only. Try a deck that contains text.
        </p>
      ) : !configured && !lecture.summary ? (
        // No key and nothing stored yet: show the graceful panel up front.
        <AiNotConfigured />
      ) : (
        <SummarizeClient
          lectureId={lecture.id}
          initialContent={lecture.summary?.content ?? null}
        />
      )}
    </div>
  );
}
