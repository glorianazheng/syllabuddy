import {
  courseLabelOf,
  updateCourse,
  type SavedCourse,
} from "@/lib/client-storage";

export type SyncOutcome = "synced" | "reauth" | "error" | "nothing-to-sync";

/**
 * Pushes every dated item of a course to Google Calendar via /api/google/sync.
 * Idempotent: items that already have a googleEventId get updated in place.
 * Returned event ids are written back to localStorage.
 */
export async function syncCourseToCalendar(course: SavedCourse): Promise<SyncOutcome> {
  const datedItems = course.items.filter((i) => i.dueDate);
  if (datedItems.length === 0) return "nothing-to-sync";

  const res = await fetch("/api/google/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courseLabel: courseLabelOf(course),
      items: datedItems.map((i) => ({
        id: i.id,
        title: i.title,
        type: i.type,
        dueDate: i.dueDate,
        notes: i.notes,
        weight: i.weight,
        googleEventId: i.googleEventId ?? null,
      })),
    }),
  });

  if (res.status === 401) return "reauth";
  if (!res.ok) return "error";

  const data: { events: Record<string, string> } = await res.json();
  updateCourse(course.id, (c) => ({
    ...c,
    items: c.items.map((item) =>
      data.events[item.id] ? { ...item, googleEventId: data.events[item.id] } : item
    ),
  }));
  return "synced";
}

/**
 * Weekly to-do: sends items due within the next 7 days that don't yet have a
 * Google Task to /api/google/tasks, and records the returned task ids.
 */
export async function ensureWeeklyTasks(courses: SavedCourse[]): Promise<SyncOutcome> {
  const candidates = courses.flatMap((course) =>
    course.items
      .filter((item) => item.dueDate && !item.googleTaskId && dueWithinSevenDays(item.dueDate))
      .map((item) => ({
        courseId: course.id,
        id: item.id,
        title: item.title,
        dueDate: item.dueDate,
        notes: item.notes,
        courseLabel: courseLabelOf(course),
      }))
  );
  if (candidates.length === 0) return "nothing-to-sync";

  const res = await fetch("/api/google/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: candidates }),
  });

  if (res.status === 401) return "reauth";
  if (!res.ok) return "error";

  const data: { tasks: Record<string, string> } = await res.json();
  for (const candidate of candidates) {
    const taskId = data.tasks[candidate.id];
    if (!taskId) continue;
    updateCourse(candidate.courseId, (c) => ({
      ...c,
      items: c.items.map((item) =>
        item.id === candidate.id ? { ...item, googleTaskId: taskId } : item
      ),
    }));
  }
  return "synced";
}

function dueWithinSevenDays(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  const due = new Date(y, m - 1, d, 23, 59, 59);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekOut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
  return due >= today && due <= weekOut;
}
