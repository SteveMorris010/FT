/**
 * Per-user lecture authorization helpers.
 *
 * Every lecture-scoped page and route must only ever see lectures that belong
 * to the requesting user. Ownership is expressed through the relation
 * `Lecture -> Subject -> User`, so the authoritative check is "does a lecture
 * with this id exist whose subject belongs to this user?".
 *
 * Centralizing the `where` clause here means the single most security-sensitive
 * invariant in the app lives in one place that can be unit-tested directly,
 * instead of being re-typed in every route.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";

/**
 * Build the Prisma `where` filter that scopes a lecture lookup to a user.
 *
 * Use with `findFirst` (NOT `findUnique`) because the filter spans a relation.
 * A lecture id that belongs to another user simply does not match, so the
 * query returns `null` rather than leaking the row.
 */
export function lectureOwnershipWhere(
  lectureId: string,
  userId: string
): Prisma.LectureWhereInput {
  return { id: lectureId, subject: { userId } };
}

/**
 * Minimal subset of PrismaClient this module needs. Accepting an interface
 * (rather than importing the singleton) keeps the function pure and easy to
 * exercise in tests against a throwaway database.
 */
type LectureFinder = Pick<PrismaClient["lecture"], "findFirst">;

/**
 * Find a lecture by id, scoped to the given user. Returns `null` when the
 * lecture does not exist OR belongs to a different user (the two cases are
 * deliberately indistinguishable to the caller, which should surface a 404 /
 * notFound in both).
 */
export async function findOwnedLecture<
  T extends { lecture: LectureFinder }
>(db: T, lectureId: string, userId: string) {
  return db.lecture.findFirst({
    where: lectureOwnershipWhere(lectureId, userId),
  });
}
