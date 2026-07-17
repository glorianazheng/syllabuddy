// Copies the pdf.js worker into public/ so the client can load it without
// webpack trying to bundle/minify it (which breaks the .mjs worker).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const workerPath = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const dest = join(process.cwd(), "public", "pdf.worker.min.mjs");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(workerPath, dest);
console.log(`Copied pdf.js worker → ${dest}`);
