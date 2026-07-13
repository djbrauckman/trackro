# Trackro

A personal weight, exercise, and macro tracker with dashboards. Plain HTML/CSS/JS, no build step — open the files directly or serve them statically. Data lives in Supabase (Postgres) so it syncs between your phone and laptop.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account/project.
2. In the SQL editor, run the contents of [`supabase/schema.sql`](supabase/schema.sql) to create the tables.
3. Go to **Project Settings → API** and copy the **Project URL** and the **anon public** key.

## 2. Configure the app

Copy [`js/config.example.js`](js/config.example.js) to `js/config.js` (gitignored) and fill in your values:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-KEY';
const APP_PASSCODE = 'pick-something-only-you-know';
```

**This repo's RLS policies are fully open** (`using (true)` on every table — see `supabase/schema.sql`), so unlike a typical Supabase setup, the anon key here is a de facto master key: anyone who has it can read/write all your data, not just their own row. `js/config.js` is gitignored for exactly this reason — don't commit your real values or hand the file out. If you want real per-user protection later, the natural upgrade is Supabase Auth + RLS policies scoped to a user id.

The passcode gate on top of this is just a convenience lock (keeps a stray visitor from poking around the UI) — it doesn't stop someone who reads the page source and calls Supabase directly with the anon key.

## 3. Run it locally

Any static file server works, e.g.:

```bash
npx serve .
# or
python3 -m http.server
```

Then open `http://localhost:<port>` in your browser.

## 4. Deploy

Because `js/config.js` is gitignored (see above), it won't exist in a fresh clone or in Vercel's git-based build — you need to get it there one of two ways:

**Option A — Vercel CLI from your machine** (simplest, no env vars needed): the CLI uploads your local working directory as-is, including the untracked `js/config.js` you already have locally.

```bash
npx vercel
```

**Option B — connect the GitHub repo in the Vercel dashboard** (enables auto-deploy on push): Vercel clones from GitHub, so it never sees your local `js/config.js`. Instead, `scripts/generate-config.js` regenerates it at build time from environment variables:

1. In the Vercel project settings, set **Framework Preset** to "Other".
2. Set **Build Command** to `node scripts/generate-config.js`.
3. Set **Output Directory** to `.` (repo root).
4. Under **Environment Variables**, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `APP_PASSCODE` with your real values.

Any other static host (Netlify, GitHub Pages, Cloudflare Pages) works the same way as Option A, as long as you upload `js/config.js` alongside the rest of the files.

## Install to your home screen

Trackro is a PWA — on your phone, open the deployed site and use "Add to Home Screen" (iOS Safari) or the install prompt (Android Chrome) to get an app icon and a standalone window without browser chrome. `manifest.json` and `sw.js` (a minimal service worker that caches the static shell for offline/flaky-connection boot) are already wired up on every page.

## Pages

- **Dashboard** (`index.html`) — overview: weight trend, today's macros vs targets, weekly exercise volume.
- **Weight** (`weight.html`) — log body weight, see trend + history.
- **Exercise** (`exercise.html`) — log workouts (cardio/lifting/core), see weekly session volume + history.
- **Macros** (`macros.html`) — log food/macros per meal, see today vs targets + calorie trend + history.
- **Goals** (`goals.html`) — set target weight and daily macro targets used by the progress bars.
