/**
 * Per-user authorization invariant (the most security-sensitive behavior in
 * the app): user B must NOT be able to read user A's lecture by id.
 *
 * Every lecture-scoped page and route funnels through the scoped query built
 * by `lectureOwnershipWhere` / `findOwnedLecture` in src/lib/lectures.ts. This
 * test exercises that query against a REAL, throwaway SQLite database so a
 * regression that drops the `subject.userId` scoping would fail here.
 *
 * The test provisions its own database file (never the dev DB) via
 * `prisma db push`, so it is hermetic and leaves no shared state behind.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/generated/prisma";
import { findOwnedLecture, lectureOwnershipWhere } from "@/lib/lectures";

let prisma: PrismaClient;
let tmpDir: string;

// Seeded ids we assert against.
let userA: string;
let userB: string;
let lectureA: string;
let lectureB: string;

beforeAll(async () => {
  // Provision an isolated SQLite database so we never touch the dev DB.
  tmpDir = mkdtempSync(join(tmpdir(), "ft-authz-"));
  const dbFile = join(tmpDir, "test.db");
  const dbUrl = `file:${dbFile}`;

  // Apply the schema to the fresh database. `db push` is schema-only and does
  // not need migration history, which keeps the test self-contained.
  execFileSync(
    "npx",
    ["prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "ignore",
    }
  );

  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

  // Two separate users, each owning one subject and one lecture.
  const a = await prisma.user.create({
    data: {
      email: "a@example.com",
      passwordHash: "x",
      subjects: {
        create: {
          name: "Food Chemistry",
          lectures: {
            create: {
              title: "Water Activity",
              originalFileName: "a.pptx",
              slideCount: 1,
            },
          },
        },
      },
    },
    include: { subjects: { include: { lectures: true } } },
  });
  const b = await prisma.user.create({
    data: {
      email: "b@example.com",
      passwordHash: "x",
      subjects: {
        create: {
          name: "Food Microbiology",
          lectures: {
            create: {
              title: "Thermal Processing",
              originalFileName: "b.pptx",
              slideCount: 1,
            },
          },
        },
      },
    },
    include: { subjects: { include: { lectures: true } } },
  });

  userA = a.id;
  userB = b.id;
  lectureA = a.subjects[0].lectures[0].id;
  lectureB = b.subjects[0].lectures[0].id;
}, 60_000);

afterAll(async () => {
  await prisma?.$disconnect();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("lectureOwnershipWhere", () => {
  it("scopes by id AND the owning user's id through the subject relation", () => {
    expect(lectureOwnershipWhere("lec-1", "user-1")).toEqual({
      id: "lec-1",
      subject: { userId: "user-1" },
    });
  });
});

describe("per-user lecture authorization", () => {
  it("lets the owner read their own lecture", async () => {
    const found = await findOwnedLecture(prisma, lectureA, userA);
    expect(found?.id).toBe(lectureA);
  });

  it("returns null when user B requests user A's lecture id (no cross-user leak)", async () => {
    const leaked = await findOwnedLecture(prisma, lectureA, userB);
    expect(leaked).toBeNull();
  });

  it("returns null when user A requests user B's lecture id", async () => {
    const leaked = await findOwnedLecture(prisma, lectureB, userA);
    expect(leaked).toBeNull();
  });

  it("returns null for a non-existent lecture id", async () => {
    const found = await findOwnedLecture(prisma, "does-not-exist", userA);
    expect(found).toBeNull();
  });
});
