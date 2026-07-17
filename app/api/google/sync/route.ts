import { NextRequest, NextResponse } from "next/server";
import {
  GoogleAuthExpiredError,
  addDays,
  getGoogleAccessToken,
  googleFetch,
} from "@/lib/google-api";

export const runtime = "nodejs";
export const maxDuration = 60;

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

interface SyncItem {
  id: string;
  title: string;
  type: string;
  dueDate: string | null;
  notes?: string | null;
  weight?: number | null;
  googleEventId?: string | null;
}

function buildEvent(item: SyncItem, courseLabel: string | null) {
  const isExam = item.type === "midterm" || item.type === "final";
  const descriptionParts = [
    courseLabel,
    item.weight != null ? `Worth ${item.weight}% of the final grade` : null,
    item.notes || null,
    "Added by Syllabuddy",
  ].filter(Boolean);

  return {
    summary: courseLabel ? `${item.title} — ${courseLabel}` : item.title,
    description: descriptionParts.join("\n"),
    start: { date: item.dueDate },
    end: { date: addDays(item.dueDate as string, 1) },
    ...(isExam ? { colorId: "11" } : {}),
    reminders: {
      useDefault: false,
      overrides: isExam
        ? [
            { method: "popup", minutes: 7 * 24 * 60 }, // 1 week before
            { method: "popup", minutes: 24 * 60 }, // 1 day before
          ]
        : [{ method: "popup", minutes: 2 * 24 * 60 }], // 2 days before
    },
  };
}

/**
 * Upserts dated items into Google Calendar. Items that already carry a
 * googleEventId are PATCHed (idempotent re-sync); if the event was deleted
 * on the Google side we fall back to inserting a fresh one.
 * Items with dueDate null are skipped entirely — they never sync.
 */
export async function POST(request: NextRequest) {
  const accessToken = await getGoogleAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }

  let body: { items?: SyncItem[]; courseLabel?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const courseLabel = typeof body.courseLabel === "string" ? body.courseLabel : null;

  const events: Record<string, string> = {};
  const failures: string[] = [];

  try {
    for (const item of items) {
      if (!item?.id || !item.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) continue;

      const event = buildEvent(item, courseLabel);

      if (item.googleEventId) {
        const patch = await googleFetch(
          accessToken,
          `${CALENDAR_BASE}/${encodeURIComponent(item.googleEventId)}`,
          { method: "PATCH", body: JSON.stringify(event) }
        );
        if (patch.ok) {
          const data = await patch.json();
          events[item.id] = data.id;
          continue;
        }
        if (patch.status !== 404 && patch.status !== 410) {
          failures.push(item.title);
          continue;
        }
        // Event vanished on Google's side — fall through and re-insert.
      }

      const insert = await googleFetch(accessToken, CALENDAR_BASE, {
        method: "POST",
        body: JSON.stringify(event),
      });
      if (insert.ok) {
        const data = await insert.json();
        events[item.id] = data.id;
      } else {
        failures.push(item.title);
      }
    }
  } catch (error) {
    if (error instanceof GoogleAuthExpiredError) {
      return NextResponse.json({ error: "reauth" }, { status: 401 });
    }
    throw error;
  }

  return NextResponse.json({ events, failures });
}
