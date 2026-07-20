import { NextRequest, NextResponse } from "next/server";
import {
  GoogleAuthExpiredError,
  getGoogleAccessToken,
  googleFetch,
} from "@/lib/google-api";

export const runtime = "nodejs";
export const maxDuration = 60;

const TASKS_BASE = "https://tasks.googleapis.com/tasks/v1";
const TASK_LIST_TITLE = "Syllabuddy";

interface TaskItem {
  id: string;
  title: string;
  dueDate: string | null;
  courseLabel?: string | null;
  notes?: string | null;
}

async function ensureTaskList(accessToken: string): Promise<string> {
  const listResponse = await googleFetch(
    accessToken,
    `${TASKS_BASE}/users/@me/lists?maxResults=100`
  );
  if (listResponse.ok) {
    const data = await listResponse.json();
    const existing = (data.items ?? []).find(
      (list: { id: string; title: string }) => list.title === TASK_LIST_TITLE
    );
    if (existing) return existing.id;
  }
  const createResponse = await googleFetch(accessToken, `${TASKS_BASE}/users/@me/lists`, {
    method: "POST",
    body: JSON.stringify({ title: TASK_LIST_TITLE }),
  });
  if (!createResponse.ok) {
    throw new Error("Could not create the Syllabuddy task list.");
  }
  const created = await createResponse.json();
  return created.id;
}

function isWithinNextSevenDays(isoDate: string): boolean {
  const [y, m, d] = isoDate.split("-").map(Number);
  const due = new Date(y, m - 1, d, 23, 59, 59);
  const now = new Date();
  const weekOut = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);
  return due >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && due <= weekOut;
}

/**
 * Adds items due within the next 7 days to the "Syllabuddy" Google Tasks
 * list. The client only sends items it hasn't recorded a task id for, so
 * repeated app opens don't duplicate tasks.
 */
export async function POST(request: NextRequest) {
  const accessToken = await getGoogleAccessToken(request);
  if (!accessToken) {
    return NextResponse.json({ error: "reauth" }, { status: 401 });
  }

  let body: { items?: TaskItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const candidates = (Array.isArray(body.items) ? body.items : []).filter(
    (item) =>
      item?.id &&
      item.title &&
      item.dueDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(item.dueDate) &&
      isWithinNextSevenDays(item.dueDate)
  );

  if (candidates.length === 0) {
    return NextResponse.json({ tasks: {} });
  }

  try {
    const taskListId = await ensureTaskList(accessToken);
    const tasks: Record<string, string> = {};

    for (const item of candidates) {
      const response = await googleFetch(
        accessToken,
        `${TASKS_BASE}/lists/${encodeURIComponent(taskListId)}/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            title: item.courseLabel ? `${item.title} — ${item.courseLabel}` : item.title,
            notes: [item.notes || null, "Added by Syllabuddy"].filter(Boolean).join("\n"),
            due: `${item.dueDate}T00:00:00.000Z`,
          }),
        }
      );
      if (response.ok) {
        const data = await response.json();
        tasks[item.id] = data.id;
      }
    }

    return NextResponse.json({ tasks });
  } catch (error) {
    if (error instanceof GoogleAuthExpiredError) {
      return NextResponse.json({ error: "reauth" }, { status: 401 });
    }
    const message = error instanceof Error ? error.message : "Google Tasks sync failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
