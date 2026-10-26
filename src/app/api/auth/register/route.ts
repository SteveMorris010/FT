import { NextRequest, NextResponse } from "next/server";
import { createSession, registerUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma";
import { credentialsSchema, firstError } from "@/lib/validation";

/**
 * Register a new account. Accepts a standard HTML form POST so the pages work
 * even without client-side JavaScript. On failure we redirect back to the
 * register page with a human-readable `?error=` message.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    const message =
      firstError(parsed.error.flatten().fieldErrors) ?? "Invalid input.";
    return redirectWithError(req, "/register", message);
  }

  const normalizedEmail = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });
  if (existing) {
    return redirectWithError(
      req,
      "/register",
      "An account with that email already exists."
    );
  }

  // The findUnique pre-check above is best-effort: two near-simultaneous
  // signups with the same email can both pass it and then race the DB's unique
  // constraint on User.email. Wrap the write so the Prisma P2002 (unique
  // constraint) maps back to the friendly "already exists" redirect instead of
  // surfacing as a 500, and so any other transient DB error degrades to a
  // generic, retry-able message.
  let user;
  try {
    user = await registerUser(parsed.data.email, parsed.data.password);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return redirectWithError(
        req,
        "/register",
        "An account with that email already exists."
      );
    }
    return redirectWithError(
      req,
      "/register",
      "Could not create your account. Please try again."
    );
  }

  await createSession(user.id);
  return NextResponse.redirect(new URL("/library", req.url), { status: 303 });
}

function redirectWithError(
  req: NextRequest,
  path: string,
  message: string
): NextResponse {
  const url = new URL(path, req.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url, { status: 303 });
}
