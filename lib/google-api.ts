import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

/**
 * Reads the Google access token from the encrypted NextAuth JWT cookie.
 * Returns null when the user needs to (re)connect Google — callers should
 * respond 401 with { error: "reauth" } so the client shows a quiet
 * "reconnect Google" button instead of an error wall.
 */
export async function getGoogleAccessToken(request: NextRequest): Promise<string | null> {
  const token = await getToken({ req: request });
  if (!token || token.error === "RefreshAccessTokenError" || !token.accessToken) {
    return null;
  }
  if (token.expiresAt && Date.now() >= token.expiresAt) {
    return null;
  }
  return token.accessToken;
}

export class GoogleAuthExpiredError extends Error {
  constructor() {
    super("Google authorization expired");
    this.name = "GoogleAuthExpiredError";
  }
}

export async function googleFetch(
  accessToken: string,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (response.status === 401 || response.status === 403) {
    // 403 with insufficient scopes also needs a re-consent round trip.
    const body = await response.clone().json().catch(() => null);
    const reason: string | undefined = body?.error?.status ?? body?.error?.message;
    if (response.status === 401 || (reason && String(reason).toLowerCase().includes("insufficient"))) {
      throw new GoogleAuthExpiredError();
    }
  }
  return response;
}

/** YYYY-MM-DD plus n days, staying in plain-date space (no timezones involved). */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}
