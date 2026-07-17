"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import {
  deleteCourse,
  loadSavedCourses,
  updateCourse,
  type SavedCourse,
} from "@/lib/client-storage";
import { ensureWeeklyTasks, syncCourseToCalendar } from "@/lib/google-sync-client";
import { GoogleConnect, useGoogleReady } from "@/components/GoogleConnect";

const TYPE_BADGES: Record<string, string> = {
  assignment: "bg-sky-100 text-sky-800",
  quiz: "bg-emerald-100 text-emerald-800",
  lab: "bg-teal-100 text-teal-800",
  midterm: "bg-rose-100 text-rose-800",
  final: "bg-rose-100 text-rose-800",
  project: "bg-indigo-100 text-indigo-800",
  other: "bg-stone-100 text-stone-700",
};

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SavedPage() {
  const [courses, setCourses] = useState<SavedCourse[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [openDatePicker, setOpenDatePicker] = useState<string | null>(null);
  const [needsReconnect, setNeedsReconnect] = useState(false);
  const googleReady = useGoogleReady();
  const backgroundSyncDone = useRef(false);

  useEffect(() => {
    setCourses(loadSavedCourses());
    setLoaded(true);
  }, []);

  // On open, while connected: push this week's items to Google Tasks and
  // catch up any dated items that haven't made it to the calendar yet.
  useEffect(() => {
    if (!loaded || !googleReady || backgroundSyncDone.current) return;
    backgroundSyncDone.current = true;
    void (async () => {
      const current = loadSavedCourses();
      let sawReauth = false;
      for (const course of current) {
        const hasUnsynced = course.items.some((i) => i.dueDate && !i.googleEventId);
        if (hasUnsynced) {
          const outcome = await syncCourseToCalendar(course);
          if (outcome === "reauth") sawReauth = true;
        }
      }
      const taskOutcome = await ensureWeeklyTasks(loadSavedCourses());
      if (taskOutcome === "reauth") sawReauth = true;
      setNeedsReconnect(sawReauth);
      setCourses(loadSavedCourses());
    })();
  }, [loaded, googleReady]);

  const addDate = useCallback(
    async (courseId: string, itemId: string, date: string) => {
      const updated = updateCourse(courseId, (c) => ({
        ...c,
        items: c.items.map((item) => (item.id === itemId ? { ...item, dueDate: date } : item)),
      }));
      setCourses(updated);
      setOpenDatePicker(null);
      if (googleReady) {
        const course = updated.find((c) => c.id === courseId);
        if (course) {
          const outcome = await syncCourseToCalendar(course);
          if (outcome === "reauth") setNeedsReconnect(true);
          setCourses(loadSavedCourses());
        }
      }
    },
    [googleReady]
  );

  function removeCourse(courseId: string) {
    deleteCourse(courseId);
    setCourses(loadSavedCourses());
  }

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My deadlines</h1>
          <p className="mt-1 text-sm text-stone-600">
            Saved on this device. Connected courses sync to Google Calendar, and anything due
            this week lands in your &ldquo;Syllabuddy&rdquo; Google Tasks list.
          </p>
        </div>
        <GoogleConnect />
      </div>

      {needsReconnect && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span>Google sync is paused — your connection needs a refresh.</span>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="shrink-0 rounded-md border border-amber-300 bg-white px-3 py-1.5 font-medium hover:bg-amber-100"
          >
            Reconnect Google ↻
          </button>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white py-20 text-center">
          <p className="text-4xl" aria-hidden>
            🗓️
          </p>
          <p className="mt-3 font-medium text-stone-700">No deadlines saved yet.</p>
          <p className="mt-1 text-sm text-stone-500">
            <Link href="/" className="text-violet-600 underline">
              Upload a syllabus
            </Link>{" "}
            to get started.
          </p>
        </div>
      ) : (
        courses.map((course) => {
          const undated = course.items.filter((i) => !i.dueDate).length;
          return (
            <section
              key={course.id}
              className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
                <div>
                  <h2 className="font-semibold">
                    {[course.courseCode, course.courseName].filter(Boolean).join(" · ") ||
                      "Untitled course"}
                  </h2>
                  <p className="text-xs text-stone-500">
                    {course.items.length} item{course.items.length === 1 ? "" : "s"}
                    {undated > 0 && (
                      <span className="text-amber-700"> · {undated} still need a date</span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeCourse(course.id)}
                  className="rounded-md px-2 py-1 text-xs text-stone-400 hover:bg-red-50 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
              <ul className="divide-y divide-stone-100">
                {course.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGES[item.type] ?? TYPE_BADGES.other}`}
                    >
                      {item.type}
                    </span>
                    <span className="min-w-0 flex-1 font-medium text-stone-800">
                      {item.title || "(untitled)"}
                    </span>
                    {item.weight != null && (
                      <span className="text-xs text-stone-500">{item.weight}%</span>
                    )}
                    {item.dueDate ? (
                      <span className="text-stone-600">{formatDate(item.dueDate)}</span>
                    ) : openDatePicker === item.id ? (
                      <input
                        type="date"
                        autoFocus
                        onChange={(e) => {
                          if (e.target.value) void addDate(course.id, item.id, e.target.value);
                        }}
                        onBlur={() => setOpenDatePicker(null)}
                        className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs focus:border-amber-500 focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOpenDatePicker(item.id)}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
                      >
                        date missing — tap to add
                      </button>
                    )}
                    <span
                      className="w-5 text-center"
                      title={
                        item.googleEventId
                          ? "On your Google Calendar"
                          : item.dueDate
                            ? "Not synced yet"
                            : "Won't sync until it has a date"
                      }
                    >
                      {item.googleEventId ? "📆" : item.dueDate ? "·" : "⏸"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
