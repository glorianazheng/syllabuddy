/**
 * Client-side PDF text extraction with pdfjs-dist.
 * Only import this from client components — pdfjs needs browser APIs.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // Served from public/ (see scripts/copy-pdf-worker.mjs) — bundling the
  // .mjs worker through webpack breaks the Next 14 build.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(line);
  }
  await pdf.destroy();

  return pages.join("\n\n").replace(/[ \t]+/g, " ").trim();
}
