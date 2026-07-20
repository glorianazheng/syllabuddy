"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  clearPendingReview,
  loadPendingReview,
  saveCourse,
  type PendingReview,
  type ReviewItem,
} from "@/lib/client-storage";
import { ITEM_TYPES } from "@/lib/syllabus-schema";
import { syncCourseToCalendar } from "@/lib/google-sync-client";
import { useGoogleReady } from "@/components/GoogleConnect";

const TYPE_LABELS: Record<string, string> = {
  assignment: "Assignment",
  quiz: "Quiz",
  lab: "Lab",
  midterm: "Midterm",
  final: "Final",
  project: "Project",
  other: "Other",
};

export default function ReviewPage() {
  const router = useRouter();
  const [pending, setPending] = useState<PendingReview | null>(null);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const googleReady = useGoogleReady();

  useEffect(() => {
    const p = loadPendingReview();
    if (p) {
      setPending(p);
      setItems(p.items);
    }
    setLoaded(true);
  }, []);

  const needsDateCount = useMemo(() => items.filter((i) => !i.dueDate).length, [items]);

  function updateItem(id: string, patch: Partial<ReviewItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function addItem() {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        title: "",
        type: "assignment",
        dueDate: null,
        dueDateRaw: null,
        dateConfidence: "none",
        weight: null,
        notes: null,
      },
    ]);
  }

  async function confirm() {
    if (!pending || saving) return;
    setSaving(true);
    const course = saveCourse(pending, items);
    if (googleReady) {
      // Dated items go straight to Google Calendar; undated ones stay
      // flagged in the app and sync once a date is added.
      try {
        await syncCourseToCalendar(course);
      } catch {
        // Sync problems never block saving — the saved page offers a retry.
      }
    }
    clearPendingReview();
    router.push("/saved");
  }

  if (!loaded) return null;

  if (!pending) {
    return (
      <div className="py-24 text-center">
        <p className="text-lg font-medium text-stone-700">Nothing to review yet.</p>
        <p className="mt-2 text-stone-500">
          <Link href="/" className="text-violet-600 underline">
            Upload a syllabus
          </Link>{" "}
          and we&apos;ll bring you back here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {pending.courseCode || pending.courseName
            ? [pending.courseCode, pending.courseName].filter(Boolean).join(" · ")
            : "Your syllabus, decoded"}
        </h1>
        <p className="mt-1 text-stone-600">
          Check everything below before saving — you can edit any cell, fix dates, or delete rows.
        </p>
      </div>

      {pending.warnings.length > 0 && !warningsDismissed && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-stone-200 bg-stone-100 px-4 py-3 text-sm text-stone-700">
          <div className="space-y-1">
            <p className="font-medium">A few things worth a look:</p>
            <ul className="list-inside list-disc space-y-0.5">
              {pending.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => setWarningsDismissed(true)}
            aria-label="Dismiss warnings"
            className="shrink-0 rounded p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-600"
          >
            ✕
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-3 py-3 font-medium">Type</th>
              <th className="px-3 py-3 font-medium">Due date</th>
              <th className="px-3 py-3 font-medium">Weight</th>
              <th className="px-2 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2 align-top">
                  <input
                    type="text"
                    value={item.title}
                    placeholder="e.g. Problem Set 3"
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                    className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 hover:border-stone-200 focus:border-violet-500 focus:bg-white focus:outline-none"
                  />
                  {item.notes && <p className="px-2 pb-1 text-xs text-stone-400">{item.notes}</p>}
                </td>
                <td className="px-3 py-2 align-top">
                  <select
                    value={item.type}
                    onChange={(e) =>
                      updateItem(item.id, { type: e.target.value as ReviewItem["type"] })
                    }
                    className="rounded-md border border-transparent bg-transparent px-2 py-1.5 hover:border-stone-200 focus:border-violet-500 focus:outline-none"
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 align-top">
                  {item.dueDate ? (
                    <div>
                      <input
                        type="date"
                        value={item.dueDate}
                        onChange={(e) =>
                          updateItem(item.id, { dueDate: e.target.value || null })
                        }
                        className="rounded-md border border-transparent bg-transparent px-2 py-1.5 hover:border-stone-200 focus:border-violet-500 focus:outline-none"
                      />
                      {(item.dateConfidence === "low" || item.dateConfidence === "medium") &&
                        item.dueDateRaw && (
                          <p className="px-2 pb-1 text-xs text-stone-400">
                            syllabus says: &ldquo;{item.dueDateRaw}&rdquo;
                          </p>
                        )}
                    </div>
                  ) : openDatePicker === item.id ? (
                    <input
                      type="date"
                      autoFocus
                      onChange={(e) => {
                        if (e.target.value) {
                          updateItem(item.id, { dueDate: e.target.value });
                          setOpenDatePicker(null);
                        }
                      }}
                      onBlur={() => setOpenDatePicker(null)}
                      className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 focus:border-amber-500 focus:outline-none"
                    />
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setOpenDatePicker(item.id)}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                      >
                        date missing — tap to add
                      </button>
                      {item.dueDateRaw && (
                        <p className="px-2 pt-1 text-xs text-stone-400">
                          syllabus says: &ldquo;{item.dueDateRaw}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="any"
                      value={item.weight ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        updateItem(item.id, {
                          weight: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      className="w-16 rounded-md border border-transparent bg-transparent px-2 py-1.5 text-right hover:border-stone-200 focus:border-violet-500 focus:outline-none"
                    />
                    <span className="text-stone-400">%</span>
                  </div>
                </td>
                <td className="px-2 py-2 align-top">
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Delete ${item.title || "row"}`}
                    className="rounded p-1.5 text-stone-300 transition hover:bg-red-50 hover:text-red-500"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-stone-500">
                  No items — add one below or go back and re-parse.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addItem}
        className="text-sm font-medium text-violet-600 hover:text-violet-800"
      >
        + Add an item
      </button>

      <div className="flex flex-col items-stretch gap-3 border-t border-stone-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-stone-500">
          {needsDateCount > 0 ? (
            <>
              <span className="font-medium text-amber-700">
                {needsDateCount} item{needsDateCount === 1 ? "" : "s"} need{needsDateCount === 1 ? "s" : ""} a date
              </span>{" "}
              — you can still confirm; dated items sync, the rest wait here.
            </>
          ) : (
            "Everything has a date. Nice."
          )}
        </p>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={items.length === 0 || saving}
          className="rounded-xl bg-violet-600 px-8 py-3 font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {saving
            ? googleReady
              ? "sending deadlines to your calendar 📆…"
              : "saving…"
            : "Looks right — save it ✅"}
        </button>
      </div>
    </div>
  );
}
