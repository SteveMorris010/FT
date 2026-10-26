/**
 * Shared zod schemas for form/route input validation.
 */

import { z } from "zod";

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(200, "Password is too long."),
});

export type Credentials = z.infer<typeof credentialsSchema>;

export const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Subject name is required.")
    .max(120, "Subject name is too long."),
});

/** Return the first error message from a flattened zod error, or null. */
export function firstError(
  flattened: Record<string, string[] | undefined>
): string | null {
  for (const messages of Object.values(flattened)) {
    if (messages && messages.length > 0) return messages[0];
  }
  return null;
}
