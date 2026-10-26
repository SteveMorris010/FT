import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePptx, PptxParseError } from "@/lib/pptx";

/** Maximum accepted upload size (25 MB) - comfortably fits lecture decks. */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Upload a lecture deck (.pptx) into a subject.
 *
 * Flow: require auth -> validate the subject belongs to the user -> validate
 * the file type/size -> parse slide text offline -> persist a Lecture plus its
 * Slides -> redirect to the new lecture's detail page.
 *
 * Policy for legacy binary `.ppt`: rejected with a clear message. `.ppt` is a
 * completely different (binary OLE) format from the OOXML `.pptx` ZIP we parse,
 * so we ask the user to re-save/export as `.pptx` from PowerPoint, Keynote, or
 * Google Slides.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return redirectWithError(req, "/login", "Please sign in to upload.");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return redirectWithError(req, "/library", "Could not read the upload.");
  }

  const subjectId = String(form.get("subjectId") ?? "");
  const titleInput = String(form.get("title") ?? "").trim();
  const file = form.get("file");

  if (!subjectId) {
    return redirectWithError(req, "/library", "Choose a subject first.");
  }

  // Ensure the subject exists and belongs to the current user.
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, userId: user.id },
  });
  if (!subject) {
    return redirectWithError(req, "/library", "Subject not found.");
  }

  if (!(file instanceof File) || file.size === 0) {
    return redirectWithError(
      req,
      "/library",
      "Select a .pptx file to upload."
    );
  }

  const name = file.name ?? "lecture.pptx";
  const lower = name.toLowerCase();

  if (lower.endsWith(".ppt") && !lower.endsWith(".pptx")) {
    return redirectWithError(
      req,
      "/library",
      "Legacy .ppt files are not supported. Open the file in PowerPoint (or Google Slides) and re-save it as .pptx, then upload again."
    );
  }

  if (!lower.endsWith(".pptx")) {
    return redirectWithError(
      req,
      "/library",
      "Only PowerPoint .pptx files are supported."
    );
  }

  if (file.size > MAX_FILE_BYTES) {
    return redirectWithError(
      req,
      "/library",
      "File is too large. The maximum upload size is 25 MB."
    );
  }

  let parsed;
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    parsed = await parsePptx(bytes);
  } catch (err) {
    const message =
      err instanceof PptxParseError
        ? err.message
        : "Could not parse the presentation.";
    return redirectWithError(req, "/library", message);
  }

  // Derive a title: use the provided one, else the file name without extension.
  const title =
    titleInput || name.replace(/\.pptx$/i, "").replace(/[_-]+/g, " ").trim() ||
    "Untitled lecture";

  const lecture = await prisma.lecture.create({
    data: {
      subjectId: subject.id,
      title,
      originalFileName: name,
      slideCount: parsed.slideCount,
      slides: {
        create: parsed.slides.map((s) => ({
          index: s.index,
          text: s.text,
        })),
      },
    },
  });

  return NextResponse.redirect(new URL(`/lectures/${lecture.id}`, req.url), {
    status: 303,
  });
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
