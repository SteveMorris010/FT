/**
 * Minimal session auth.
 *
 * - Passwords are hashed with bcryptjs.
 * - Sessions are an HMAC-signed, httpOnly cookie that stores the userId.
 *   (No external session store needed for a single-user study app.)
 *
 * The cookie value is `<userId>.<signature>` where signature =
 * HMAC-SHA256(userId, AUTH_SECRET). This lets us verify the cookie was not
 * tampered with without a database lookup.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import type { User } from "@/generated/prisma";

const SESSION_COOKIE = "ft_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getSecret(): string {
  // A dev fallback keeps the app booting without configuration. Production
  // deployments should always set AUTH_SECRET.
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex");
}

function makeToken(userId: string): string {
  return `${userId}.${sign(userId)}`;
}

function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const idx = token.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = token.slice(0, idx);
  const signature = token.slice(idx + 1);
  const expected = sign(userId);
  // Constant-time comparison to avoid timing attacks.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;
  return userId;
}

/** Hash a plaintext password for storage. */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/** Verify a plaintext password against a stored hash. */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Register a new user. Throws if the email is already taken. */
export async function registerUser(
  email: string,
  password: string
): Promise<User> {
  const passwordHash = await hashPassword(password);
  return prisma.user.create({
    data: { email: email.toLowerCase().trim(), passwordHash },
  });
}

/** Look up a user by email/password. Returns null on bad credentials. */
export async function authenticate(
  email: string,
  password: string
): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

/** Write the session cookie for a user (call after login/register). */
export async function createSession(userId: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, makeToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/** Clear the session cookie (logout). */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Return the currently authenticated user, or null if the request has no
 * valid session. Safe to call from server components and route handlers.
 */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const userId = verifyToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user ?? null;
}

/**
 * Like {@link getCurrentUser} but throws when unauthenticated. Use in route
 * handlers and server actions that require a logged-in user.
 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}
