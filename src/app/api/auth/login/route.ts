import { NextRequest, NextResponse } from "next/server";
import { authenticate, createSession } from "@/lib/auth";
import { credentialsSchema, firstError } from "@/lib/validation";

/**
 * Log in with email + password (HTML form POST). On success set the session
 * cookie and redirect to the library; on failure redirect back with an error.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const parsed = credentialsSchema.safeParse({ email, password });
  if (!parsed.success) {
    const message =
      firstError(parsed.error.flatten().fieldErrors) ?? "Invalid input.";
    return redirectWithError(req, "/login", message);
  }

  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return redirectWithError(req, "/login", "Incorrect email or password.");
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
