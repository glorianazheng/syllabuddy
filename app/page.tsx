"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { extractPdfText } from "@/lib/extract-pdf-text";
import { stashPendingReview } from "@/lib/client-storage";
import type { ParsedSyllabus } from "@/lib/syllabus-schema";

type Tab = "pdf" | "paste";

const LOADING_LINES = [
  "reading your syllabus so you don't have to 📖",
  "hunting down every sneaky deadline 🔍",
  "doing the grade-weight math ➗",
  "translating 'Week 5, Friday' into an actual date 📅",
  "almost there — untangling the quiz schedule 🧶",
];

export default function UploadPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("pdf");
  const [pdfName, setPdfName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [pastedText, setPastedText] = useState<string>("");
  const [semesterStartDate, setSemesterStartDate] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [loadingLine, setLoadingLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!parsing) return;
    const timer = setInterval(
      () => setLoadingLine((i) => (i + 1) % LOADING_LINES.length),
      2600
    );
    return () => clearInterval(timer);
  }, [parsing]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("That doesn't look like a PDF. Try the paste-text tab instead?");
      return;
    }
    setExtracting(true);
    setPdfName(file.name);
    try {
      const text = await extractPdfText(file);
      if (!text.trim()) {
        setPdfName(null);
        setError(
          "We couldn't find any selectable text in that PDF — it might be a scan. Try pasting the text instead."
        );
        return;
      }
      setPdfText(text);
    } catch {
      setPdfName(null);
      setError("We couldn't read that PDF. Try a different file, or paste the text.");
    } finally {
      setExtracting(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const text = tab === "pdf" ? pdfText : pastedText;
  const canSubmit = text.trim().length > 0 && !extracting && !parsing;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    setParsing(true);
    setLoadingLine(0);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          semesterStartDate: semesterStartDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong while parsing. Try again?");
        return;
      }
      stashPendingReview(data as ParsedSyllabus, semesterStartDate || null);
      router.push("/review");
    } catch {
      setError("Network hiccup — check your connection and try again.");
    } finally {
      setParsing(false);
    }
  }

  if (parsing) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
        <div className="animate-bounce text-5xl" aria-hidden>
          📖
        </div>
        <p className="text-lg font-medium text-stone-700" aria-live="polite">
          {LOADING_LINES[loadingLine]}
        </p>
        <p className="text-sm text-stone-500">this usually takes 15–30 seconds</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Never miss a deadline again</h1>
        <p className="text-stone-600">
          Upload a syllabus and Syllabuddy pulls out every assignment, quiz, lab, exam, and
          project — with due dates and grade weights.
        </p>
      </div>

      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex rounded-lg border border-stone-200 bg-white p-1 text-sm font-medium">
          {(
            [
              ["pdf", "Upload a PDF"],
              ["paste", "Paste text"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 rounded-md px-4 py-2 transition ${
                tab === key ? "bg-violet-600 text-white shadow-sm" : "text-stone-600 hover:text-stone-900"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "pdf" ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-14 text-center transition ${
              dragOver
                ? "border-violet-500 bg-violet-50"
                : "border-stone-300 bg-white hover:border-violet-400 hover:bg-violet-50/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            <span className="text-4xl" aria-hidden>
              {extracting ? "⏳" : pdfName ? "✅" : "📄"}
            </span>
            {extracting ? (
              <p className="font-medium text-stone-700">Reading {pdfName}…</p>
            ) : pdfName ? (
              <div>
                <p className="font-medium text-stone-800">{pdfName}</p>
                <p className="mt-1 text-sm text-stone-500">
                  {pdfText.length.toLocaleString()} characters extracted — drop another file to replace it
                </p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-stone-800">Drag &amp; drop your syllabus PDF here</p>
                <p className="mt-1 text-sm text-stone-500">or click to browse — nothing is uploaded until you hit parse</p>
              </div>
            )}
          </div>
        ) : (
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Paste the full syllabus text here — schedule and grading sections especially."
            rows={12}
            className="w-full rounded-xl border border-stone-300 bg-white p-4 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        )}

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <label htmlFor="semester-start" className="block text-sm font-medium text-stone-800">
            When does your semester start?
          </label>
          <p className="mt-0.5 text-xs text-stone-500">
            Helps us turn things like &ldquo;Week 5, Friday&rdquo; into real dates. Optional but recommended.
          </p>
          <input
            id="semester-start"
            type="date"
            value={semesterStartDate}
            onChange={(e) => setSemesterStartDate(e.target.value)}
            className="mt-2 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSubmit}
          className="w-full rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          Parse my syllabus ✨
        </button>
      </div>
    </div>
  );
}
