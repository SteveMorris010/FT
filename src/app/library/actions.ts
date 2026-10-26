"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { subjectSchema, firstError } from "@/lib/validation";

/**
 * Server action: create a new Subject for the current user. On validation
 * failure we redirect back to /library with an `?error=` message so the page
 * can show it inline.
 */
export async function createSubject(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = subjectSchema.safeParse({
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) {
    const message =
      firstError(parsed.error.flatten().fieldErrors) ?? "Invalid input.";
    redirect(`/library?error=${encodeURIComponent(message)}`);
  }

  await prisma.subject.create({
    data: { userId: user.id, name: parsed.data.name },
  });

  revalidatePath("/library");
  redirect("/library");
}
