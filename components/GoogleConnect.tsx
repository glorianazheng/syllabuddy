"use client";

import { signIn, signOut, useSession } from "next-auth/react";

/**
 * Quiet Google connection status. Expired tokens get a soft "reconnect"
 * button — never an error wall.
 */
export function GoogleConnect() {
  const { data: session, status } = useSession();

  if (status === "loading") return null;

  if (!session) {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-violet-400 hover:text-violet-700"
      >
        Connect Google to sync deadlines ↗
      </button>
    );
  }

  if (session.error === "RefreshAccessTokenError") {
    return (
      <button
        type="button"
        onClick={() => signIn("google")}
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
      >
        Google needs a quick reconnect ↻
      </button>
    );
  }

  return (
    <p className="text-sm text-stone-500">
      Syncing with Google{session.user?.email ? ` as ${session.user.email}` : ""} ·{" "}
      <button type="button" onClick={() => signOut()} className="underline hover:text-stone-700">
        disconnect
      </button>
    </p>
  );
}

/** True when calendar/tasks calls are expected to succeed. */
export function useGoogleReady(): boolean {
  const { data: session, status } = useSession();
  return status === "authenticated" && !session?.error;
}
