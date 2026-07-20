import type { ParsedSyllabus, SyllabusItem } from "@/lib/syllabus-schema";

/** A parsed item plus client-side editing/sync state. */
export interface ReviewItem extends SyllabusItem {
  id: string;
  /** Google Calendar event id once synced — lets re-syncs update instead of duplicate. */
  googleEventId?: string | null;
  /** Google Tasks task id once pushed to the weekly to-do list. */
  googleTaskId?: string | null;
}

export interface PendingReview {
  courseName: string | null;
  courseCode: string | null;
  semesterStartDate: string | null;
  items: ReviewItem[];
  warnings: string[];
}

export interface SavedCourse {
  id: string;
  courseName: string | null;
  courseCode: string | null;
  semesterStartDate: string | null;
  confirmedAt: string; // ISO timestamp
  items: ReviewItem[];
}

const PENDING_KEY = "syllabuddy:pending-review";
const SAVED_KEY = "syllabuddy:courses";

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function stashPendingReview(parsed: ParsedSyllabus, semesterStartDate: string | null): void {
  const pending: PendingReview = {
    courseName: parsed.courseName,
    courseCode: parsed.courseCode,
    semesterStartDate,
    items: parsed.items.map((item) => ({ ...item, id: makeId() })),
    warnings: parsed.warnings,
  };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
}

export function loadPendingReview(): PendingReview | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingReview) : null;
  } catch {
    return null;
  }
}

export function clearPendingReview(): void {
  sessionStorage.removeItem(PENDING_KEY);
}

export function loadSavedCourses(): SavedCourse[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as SavedCourse[]) : [];
  } catch {
    return [];
  }
}

export function saveCourse(pending: PendingReview, items: ReviewItem[]): SavedCourse {
  const course: SavedCourse = {
    id: makeId(),
    courseName: pending.courseName,
    courseCode: pending.courseCode,
    semesterStartDate: pending.semesterStartDate,
    confirmedAt: new Date().toISOString(),
    items,
  };
  const all = loadSavedCourses();
  all.unshift(course);
  localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  return course;
}

export function deleteCourse(courseId: string): void {
  const remaining = loadSavedCourses().filter((c) => c.id !== courseId);
  localStorage.setItem(SAVED_KEY, JSON.stringify(remaining));
}

export function updateCourse(
  courseId: string,
  updater: (course: SavedCourse) => SavedCourse
): SavedCourse[] {
  const all = loadSavedCourses().map((c) => (c.id === courseId ? updater(c) : c));
  localStorage.setItem(SAVED_KEY, JSON.stringify(all));
  return all;
}

export function courseLabelOf(course: {
  courseCode: string | null;
  courseName: string | null;
}): string | null {
  return course.courseCode || course.courseName || null;
}
