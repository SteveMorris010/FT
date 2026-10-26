import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parsePptx, PptxParseError } from "@/lib/pptx";

/**
 * Build a minimal slide XML part containing the given text runs. Each run is
 * wrapped in an `<a:t>` element, mirroring how PowerPoint stores text.
 */
function slideXml(runs: string[]): string {
  const paragraphs = runs
    .map(
      (t) =>
        `<a:p><a:r><a:rPr lang="en-US"/><a:t>${t}</a:t></a:r></a:p>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:sp>
        <p:txBody>
          ${paragraphs}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;
}

/** An empty slide body (no `<a:t>` text runs at all). */
function emptySlideXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`;
}

/** Assemble an in-memory .pptx (ZIP) from a list of slide XML strings. */
async function buildPptx(slides: string[]): Promise<Buffer> {
  const zip = new JSZip();
  // A couple of parts a real deck carries; not strictly required by the
  // parser but keep the archive realistic.
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>`
  );
  slides.forEach((xml, i) => {
    zip.file(`ppt/slides/slide${i + 1}.xml`, xml);
  });
  return zip.generateAsync({ type: "nodebuffer" });
}

describe("parsePptx", () => {
  it("extracts text per slide in slide order", async () => {
    const buffer = await buildPptx([
      slideXml(["Hello", "world"]),
      slideXml(["Second", "slide", "text"]),
    ]);

    const result = await parsePptx(buffer);

    expect(result.slideCount).toBe(2);
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0]).toEqual({ index: 1, text: "Hello world" });
    expect(result.slides[1]).toEqual({ index: 2, text: "Second slide text" });
  });

  it("returns empty text for a slide with no text runs", async () => {
    const buffer = await buildPptx([
      slideXml(["Only slide one has text"]),
      emptySlideXml(),
    ]);

    const result = await parsePptx(buffer);

    expect(result.slideCount).toBe(2);
    expect(result.slides[0].text).toBe("Only slide one has text");
    expect(result.slides[1]).toEqual({ index: 2, text: "" });
  });

  it("orders slides numerically (slide10 after slide2)", async () => {
    // Insert out of order and with a double-digit slide to catch string-sort bugs.
    const zip = new JSZip();
    zip.file("ppt/slides/slide10.xml", slideXml(["ten"]));
    zip.file("ppt/slides/slide2.xml", slideXml(["two"]));
    zip.file("ppt/slides/slide1.xml", slideXml(["one"]));
    const buffer = await zip.generateAsync({ type: "nodebuffer" });

    const result = await parsePptx(buffer);

    expect(result.slideCount).toBe(3);
    expect(result.slides.map((s) => s.text)).toEqual(["one", "two", "ten"]);
    expect(result.slides.map((s) => s.index)).toEqual([1, 2, 3]);
  });

  it("collapses whitespace across runs", async () => {
    const buffer = await buildPptx([slideXml(["  spaced   ", "   out  "])]);
    const result = await parsePptx(buffer);
    expect(result.slides[0].text).toBe("spaced out");
  });

  it("throws PptxParseError on non-archive input", async () => {
    await expect(parsePptx(Buffer.from("not a zip"))).rejects.toBeInstanceOf(
      PptxParseError
    );
  });

  it("throws PptxParseError when there are no slide parts", async () => {
    const zip = new JSZip();
    zip.file("[Content_Types].xml", "<Types/>");
    const buffer = await zip.generateAsync({ type: "nodebuffer" });
    await expect(parsePptx(buffer)).rejects.toBeInstanceOf(PptxParseError);
  });
});
