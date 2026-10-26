import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { lectureOwnershipWhere } from "@/lib/lectures";
import { isAIConfigured } from "@/lib/ai/provider";
import { buildSlideContext, hasEnoughText } from "@/lib/ai/prompts";
import AiNotConfigured from "@/components/AiNotConfigured";
import UnderstandClient from "./UnderstandClient";

export const metadata = { title: "Understand - FoodTech Study" };

export default async function UnderstandPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const lecture = await prisma.lecture.findFirst({
    where: lectureOwnershipWhere(id, user.id),
    include: { slides: { orderBy: { index: "asc" } } },
  });

  if (!lecture) notFound();

  const configured = isAIConfigured();
  const context = buildSlideContext(lecture.slides);
  const enoughText = hasEnoughText(context);

  // Load the stored conversation for this user + lecture (oldest first).
  const stored = await prisma.chatMessage.findMany({
    where: { lectureId: lecture.id, userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });
  const initialMessages = stored.map((m) => ({
    id: m.id,
    role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
    content: m.content,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`/lectures/${lecture.id}`}
          className="text-sm text-foreground/50 transition-colors hover:text-accent"
        >
          &larr; {lecture.title}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Understand</h1>
        <p className="text-sm text-foreground/60">
          Ask questions about this lecture. Answers are grounded in the slide
          text and kept technically precise.
        </p>
      </div>

      {!enoughText ? (
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground/70">
          There isn&apos;t enough extractable text in this deck to answer
          questions about it. The slides may be image-only.
        </p>
      ) : !configured && initialMessages.length === 0 ? (
        <AiNotConfigured />
      ) : (
        <UnderstandClient
          lectureId={lecture.id}
          initialMessages={initialMessages}
        />
      )}
    </div>
  );
}
