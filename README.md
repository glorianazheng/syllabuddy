# Syllabuddy 📚

Upload a course syllabus → get every assignment, quiz, lab, midterm, final, and
project extracted with due dates and grade weights → review & fix → sync to
Google Calendar and Google Tasks.

Built with Next.js 14 (App Router), TypeScript, Tailwind, NextAuth.js, and the
Anthropic API. Designed to deploy on Vercel.

## How it works

1. **Upload** (`/`) — drag-and-drop a PDF (text extracted client-side with
   `pdfjs-dist`; the file itself never leaves the browser) or paste the
   syllabus text. Optionally pick the semester start date so relative dates
   like "Week 5, Friday" resolve to real dates.
2. **Parse** — `POST /api/parse` calls `parseSyllabus()`
   (`lib/syllabus-parser.ts`: Zod schema + Anthropic structured outputs)
   server-side. The API key never reaches the client.
3. **Review** (`/review`) — an editable table of everything found, *before*
   anything syncs anywhere. Items with no date get a soft amber
   "date missing — tap to add" chip; low/medium-confidence dates show the
   syllabus's original wording underneath; parser warnings appear in one
   dismissible banner. Confirming is allowed even with missing dates — those
   just don't sync until they get one.
4. **Sync** — on confirm, dated items go to Google Calendar:
   - midterms & finals: red (`colorId 11`) with reminders 1 week and 1 day out
   - everything else: a 2-day reminder
   - event ids are stored per item, so re-syncs update instead of duplicate
5. **Weekly to-do** — when the app opens, anything due in the next 7 days that
   isn't already in Google Tasks is added to a "Syllabuddy" task list.
6. **Storage** — confirmed data lives in `localStorage` for now (auth'd DB is
   Phase 2); Google sync state (event/task ids) is stored alongside each item.

## Environment variables

| Variable | What it's for |
|---|---|
| `ANTHROPIC_API_KEY` | Server-side syllabus parsing |
| `GOOGLE_CLIENT_ID` | Google OAuth client (Web application type) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `NEXTAUTH_SECRET` | Encrypts the session JWT (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App origin, e.g. `https://syllabuddy.vercel.app` (use `http://localhost:3000` locally) |

### Google Cloud setup

1. Create an OAuth 2.0 Client ID (type: Web application) in the
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Add the redirect URI: `<your-origin>/api/auth/callback/google`.
3. Enable the **Google Calendar API** and **Google Tasks API** for the project.
4. Requested scopes: `calendar.events` and `tasks` (plus openid/email/profile).

Google access/refresh tokens are kept only inside the encrypted NextAuth
session cookie (JWT strategy) — nothing is persisted server-side, so this runs
statelessly on Vercel. When a refresh token dies, the UI shows a quiet
"Reconnect Google" button.

## Develop

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev
```

## Deploy

Push to Vercel, set the environment variables above for Production (and
Preview if you want), and you're done.
