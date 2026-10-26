/**
 * Offline PPTX (PowerPoint) slide-text extractor.
 *
 * A `.pptx` file is just a ZIP archive of XML parts (the Open XML / OOXML
 * format). The slide text we care about lives in `ppt/slides/slideN.xml`,
 * inside DrawingML `<a:t>` ("text run") elements. This module opens the
 * archive with JSZip, parses each slide's XML with fast-xml-parser, and
 * collects the text runs in document order.
 *
 * This is deliberately PURE and OFFLINE: it never touches the network and
 * never imports the AI provider. It only transforms bytes -> structured text,
 * so it is easy to unit test and safe to run without any API key.
 */

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

/** A single slide's extracted text. `index` is 1-based (slide order). */
export interface ParsedSlide {
  index: number;
  text: string;
}

/** The result of parsing a deck. */
export interface ParsedPptx {
  slideCount: number;
  slides: ParsedSlide[];
}

/** Thrown when the provided bytes are not a usable `.pptx` archive. */
export class PptxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PptxParseError";
  }
}

// Matches `ppt/slides/slide<number>.xml` (but not the rels in the `_rels`
// subfolder, which live at `ppt/slides/_rels/slideN.xml.rels`).
const SLIDE_PATH_RE = /^ppt\/slides\/slide(\d+)\.xml$/;

// Configure the parser once. We only need element text, and we ignore
// attributes to keep the parsed tree small. `<a:t>` nodes sometimes carry
// whitespace that is semantically significant, so we do not trim text nodes
// at parse time (we collapse whitespace ourselves afterwards).
const parser = new XMLParser({
  ignoreAttributes: true,
  // Keep namespace prefixes (e.g. `a:t`) so our walker can target them.
  removeNSPrefix: false,
  // Ensure text content is captured under a predictable key.
  textNodeName: "#text",
  // Numbers like "1.0" inside text must stay strings, not become numbers.
  parseTagValue: false,
  trimValues: false,
});

/** Collapse all runs of whitespace to single spaces and trim the ends. */
function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Recursively walk a parsed XML node and collect the text of every `<a:t>`
 * element in document order. fast-xml-parser represents repeated elements as
 * arrays and single elements as objects, so we handle both.
 */
function collectTextRuns(node: unknown, out: string[]): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) collectTextRuns(item, out);
    return;
  }

  if (typeof node !== "object") return;

  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === "a:t") {
      // An `<a:t>` may be a string, a number-like string, an array of such,
      // or an object with a `#text` child when it also has attributes.
      extractTextNode(value, out);
    } else {
      collectTextRuns(value, out);
    }
  }
}

function extractTextNode(value: unknown, out: string[]): void {
  if (value == null) return;
  if (Array.isArray(value)) {
    for (const item of value) extractTextNode(item, out);
    return;
  }
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (typeof value === "number") {
    out.push(String(value));
    return;
  }
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    if (text != null) out.push(String(text));
  }
}

/**
 * Parse a `.pptx` archive and return the per-slide text in slide order.
 *
 * @param input Raw bytes of the `.pptx` file.
 * @throws {PptxParseError} if the bytes are not a valid PPTX archive.
 */
export async function parsePptx(
  input: Buffer | ArrayBuffer | Uint8Array
): Promise<ParsedPptx> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(input);
  } catch {
    throw new PptxParseError(
      "Could not read the file as a .pptx archive. Make sure it is a valid PowerPoint (.pptx) file."
    );
  }

  // Find every slide part and sort numerically by its slide number so that
  // slide10 comes after slide9 (string sort would place it after slide1).
  const slidePaths: { path: string; num: number }[] = [];
  zip.forEach((relativePath) => {
    const match = SLIDE_PATH_RE.exec(relativePath);
    if (match) {
      slidePaths.push({ path: relativePath, num: Number(match[1]) });
    }
  });

  if (slidePaths.length === 0) {
    throw new PptxParseError(
      "No slides were found in the file. It may be empty or not a valid .pptx presentation."
    );
  }

  slidePaths.sort((a, b) => a.num - b.num);

  const slides: ParsedSlide[] = [];
  for (let i = 0; i < slidePaths.length; i++) {
    const file = zip.file(slidePaths[i].path);
    // Preserve slide boundaries even when a part is unexpectedly missing.
    const xml = file ? await file.async("string") : "";
    const runs: string[] = [];
    if (xml) {
      const tree = parser.parse(xml);
      collectTextRuns(tree, runs);
    }
    // Join runs with spaces, then collapse. A slide with no text becomes "".
    const text = collapseWhitespace(runs.join(" "));
    slides.push({ index: i + 1, text });
  }

  return { slideCount: slides.length, slides };
}
