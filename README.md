# STATS Research Feed

**Your personalized research inbox.**

A research productivity tool for organizational and I/O psychology
researchers. It pulls recent publications from a set of journals you choose,
and — unlike a plain RSS reader — it remembers what you've already seen, so
you can pick up exactly where you left off the next time you check in.

Built for the STATS Lab at CMC.

---

## What problem this solves

This project exists to fix two specific frustrations with literature feeds
that a research professor identified:

**1. "Where did I leave off?"**
Researchers check a feed sporadically — maybe once a week, maybe once a
month. When you come back, you shouldn't have to re-skim everything you've
already read to figure out what's new. STATS Research Feed tracks, in your
browser, which articles you've seen, which are new since your last visit,
and roughly where you stopped scrolling — then gives you a one-click
**"Continue where you left off"** to jump back there.

**2. "I only care about my journals."**
Every researcher follows a different slice of the literature. Instead of one
fixed list, you get a **journal watchlist** you can search, customize, and
change any time — your choices persist and immediately reshape the feed.

Everything else in the app (search, filters, sorting, abstracts, open-access
badges) exists in service of those two goals.

## Inspiration

This project was inspired by [Kayla Walters' public I/O psychology journal
feed](https://kayla-walters.github.io/io-psych-journal-feed/research_feed.html),
a great demonstration of what a lightweight literature feed can look like.
**No code from that project was used or adapted** — STATS Research Feed is
an independent implementation, built from scratch with its own data layer,
persistence model, and design system, specifically to add the seen/unseen
and watchlist-customization features described above.

---

## How it works

### The journal watchlist

The app ships with a default catalog of 26 organizational/I/O psychology
journals (see [`src/lib/journals/catalog.ts`](src/lib/journals/catalog.ts)),
all followed by default. Open **Manage journals** to search, check/uncheck
individual journals, select all, clear all, or restore the defaults. Your
choices are saved in your browser and immediately reshape the feed.

### Seen / unseen tracking

Seen/unseen state is **entirely manual and deterministic** — click
**Mark as seen** on any article, and click it again to mark it unseen.
Nothing is ever marked seen automatically by scrolling, hovering, or simply
being rendered on screen; an earlier version experimented with automatic
viewport-dwell detection and it was inconsistent in practice, so it was
removed in favor of an explicit, predictable control. Seen articles stay
fully readable but visually recede a little (lighter weight, no unread
accent stripe) so unseen articles stand out.

### "New since your last visit"

The app tracks two timestamps: your current session's activity, and the
*end* of your previous session. A page reload doesn't immediately overwrite
your "previous visit" marker — a real gap in activity (30+ minutes) has to
pass first. That's what makes "3 new since your last visit" mean something:
reloading the page five times in a row won't reset it to zero, and your
very first-ever visit never misleadingly claims the whole 90-day feed is
"new."

### Continue where you left off

The rule is simple and fully deterministic: **Continue** always points to the
*first unseen article, newest-first, across your currently followed
journals*. It's recomputed on every render from your current article set and
seen-state — never persisted, never based on scroll position, viewport
occupancy, or hover — so it can't go stale and always reflects manual
seen/unseen changes immediately, including after a refresh. If you haven't
marked anything seen yet, the banner doesn't show (there's nothing to
resume). If everything is seen, it shows a "you're all caught up" state
instead. Clicking Continue clears any active search/filter so the target is
always reachable, and scrolls straight to it.

---

## Architecture

```
src/
  app/                    Next.js App Router entry (layout, page, global CSS)
  components/
    ui/                   Small hand-built shadcn/ui-style primitives
                           (Button, Card, Dialog, Checkbox, Switch, …)
    feed/                 Feed-specific UI (ArticleCard, FeedControls,
                           FeedStatusBar, empty/loading/error states, …)
    journals/              Journal watchlist management dialog
  hooks/                  React hooks: watchlist, seen state, bookmarks,
                           visit tracking, first-run notice
  lib/
    journals/catalog.ts   The static journal catalog (name + ISSNs)
    feed/continueTarget.ts Pure function deriving the "Continue where you
                           left off" target from articles + seen state
    openalex/              OpenAlex data-access layer (client, source
                           resolution, work fetching, normalization, demo
                           fallback data) — the ONLY place that talks to
                           OpenAlex
    storage/               Isolated localStorage adapter + key registry
    types.ts               Shared Article/Journal/filter types
    utils/                 Date formatting, text sanitization, cn() helper
```

The guiding rule: **UI components never call OpenAlex or `localStorage`
directly.** They call hooks (`useWatchlist`, `useSeenState`, …) or the
`getFeedArticles()` function from `lib/openalex/feed.ts`. That keeps the
data-fetching and persistence logic centralized, testable, and swappable.

## Tech stack

- **Next.js 16** (App Router, Turbopack) + **TypeScript** (strict mode)
- **Tailwind CSS v4** — design tokens from the STATS Lab style guide (cream
  background, maroon primary, restrained blue/purple accents, Inter
  typeface, `0.5rem` corner radii, no gradients/glassmorphism)
- Hand-built **shadcn/ui-style** primitives on top of Radix UI primitives
  (`@radix-ui/react-dialog`, `-checkbox`, `-switch`, `-separator`) — no
  heavyweight component library
- **React hooks + `useSyncExternalStore`** for state — no Redux/Zustand/etc.
- **OpenAlex** as the live research metadata source (see below)
- No backend, no database, no authentication — this is a client-only V1

## OpenAlex integration

[OpenAlex](https://openalex.org) is a free, fully open scholarly index that
requires **no API key**. The data-access layer (`src/lib/openalex/`) does
the following, without ever hand-typing a guessed OpenAlex ID:

1. **Resolve journals → OpenAlex Source IDs by ISSN, cached per journal.**
   Every journal in the catalog carries its print/online ISSNs (cross-checked
   against the ISSN International Centre portal, publisher pages, and
   Wikipedia). Each journal's resolved Source ID (or confirmed
   "unresolvable") is cached independently in `localStorage` for 24 hours
   (`src/lib/openalex/sources.ts`). Only journals whose cached resolution is
   missing or stale are looked up — and those are still batched into as few
   `GET /sources?filter=issn:a|b|c|...` requests as possible (never one
   request per journal), never a fuzzy title match.
2. **Fetch recent works by source, cached per journal.** Each journal's
   recent works are cached independently for 20 minutes
   (`src/lib/openalex/feed.ts`). Only journals whose cache is missing or
   stale get fetched, and — same principle — every stale/missing journal in
   one load is OR'd together into as few
   `GET /works?filter=primary_location.source.id:S1|S2|...,
   from_publication_date:<90 days ago>,type:article|review,is_retracted:false`
   requests as possible, paginated via OpenAlex's cursor API and capped at a
   sane number of pages per batch. Because each journal's data is cached
   independently, **toggling a journal in the watchlist is a purely local
   operation** — unfollowing never triggers a network call, and re-following
   a journal whose data is still fresh is instant. Only genuinely new or
   stale journals ever hit the network, and identical concurrent requests
   (same URL in flight at the same time) are de-duplicated in
   `src/lib/openalex/client.ts`.
3. **Filter to genuine scholarly content.** The `type:article|review,
   is_retracted:false` filter (verified against OpenAlex's current API docs,
   including its July 2026 type-classification overhaul) excludes errata,
   corrections, editorials, letters, and retracted works server-side, while
   keeping legitimate review articles. `normalize.ts` re-checks the same
   condition defensively in case a record is missing the field or a future
   code path queries OpenAlex without the filter.
4. **Normalize** every OpenAlex work into a consistent internal `Article`
   shape — reconstructing the abstract from OpenAlex's inverted-index
   format, extracting a safe DOI/article URL, and gracefully defaulting
   missing authors/dates/OA status/abstracts instead of erroring. Only these
   normalized fields are cached — never raw OpenAlex response payloads — to
   keep the `localStorage` footprint compact.
5. **De-duplicate** by work ID and then by DOI.

All UI-level filtering and sorting — text search, seen/unseen, Open Access,
sort order, expanding an abstract, marking an article seen — operates
entirely on the already-fetched, already-cached article set in memory and
never triggers a new OpenAlex request.

If OpenAlex can't be reached, or a specific journal's source can't be
resolved, the app **never fabricates data or fakes a live result**. Instead
it falls back to a small, clearly-labeled demo dataset (every title is
prefixed "Demo Article:", carries a "Demo data" badge, and a banner explains
what happened) so the app still renders something useful. Any journal that
couldn't be resolved is flagged directly in the "Manage journals" dialog.

### Caching model at a glance

| What | Where | Granularity | TTL |
|---|---|---|---|
| Journal → OpenAlex Source ID | `localStorage` (`stats-feed:openalex-source-cache`) | per journal | 24h |
| Recent works per journal | `localStorage` (`stats-feed:openalex-works-cache`) | per journal | 20min |
| In-flight duplicate requests | in-memory (per browser tab) | per exact URL | until settled |

Everything is per-browser, client-side `localStorage` — there's no server, so
nothing is shared across users or devices, and a hard refresh just re-reads
the same cache (no data loss). This is intentionally simple for a research
prototype; a future version with a backend could add a shared server-side
cache, but that's out of scope here.

## Running it locally

Requirements: Node.js 18.18+ (Node 22 recommended) and npm.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000). No environment
variables, API keys, or accounts are required — it works immediately.

Other useful commands:

```bash
npm run build   # production build
npm run start   # run the production build locally
npm run lint    # ESLint
```

> **Note on this development environment:** the sandbox this app was
> originally built in, and the sandbox the Aug 2026 Zhou-feedback
> remediation pass was implemented in, both block outbound network access
> (the V1 sandbox to `api.openalex.org` specifically; the remediation
> sandbox blocked essentially all direct package-registry/API egress, which
> also meant `npm install` itself could not complete there). Live OpenAlex
> retrieval and a running `npm run dev`/`npm run build` were not exercised
> end-to-end in either session — verify both once this runs somewhere with
> normal internet access (your own machine, Vercel, etc.). The OpenAlex
> integration code follows OpenAlex's documented, no-key REST API and was
> checked against OpenAlex's live documentation (not just training memory)
> during the remediation pass — see the PR description for exactly what was
> and wasn't verified.

## How local persistence works

Everything the app remembers about you lives in your browser's
`localStorage` — there is no server, no account, and nothing leaves your
device. See `src/lib/storage/localStorageAdapter.ts` and
`src/lib/storage/keys.ts` for the full list of keys. In short, it persists:

- Your followed journal IDs
- Which article IDs you've marked seen (manually — see "Seen / unseen
  tracking" above)
- Your previous-visit timestamp (used for "new since last visit")
- Saved/bookmarked articles — a **full snapshot** of each article (title,
  authors, journal, date, abstract, link), not just its id, so a saved
  article stays viewable in the **Saved** tab even if you later unfollow
  its journal or it ages out of the 90-day feed window
- Whether you've dismissed the first-run notice
- Per-journal caches of OpenAlex source-ID resolutions and recent works (to
  avoid refetching data that's already fresh — see "Caching model at a
  glance" above)

"Continue where you left off" is **not** persisted — it's recomputed on every
render from your current articles and seen-state (see "Continue where you
left off" above), so there's nothing to list here for it.

All reads/writes go through one small adapter (`storage.get/set/remove`),
and every hook that owns a piece of state (`useWatchlist`, `useSeenState`,
etc.) is built on that adapter plus `useSyncExternalStore` — never
`localStorage` calls scattered through components.

## Migrating from localStorage to a real backend later

Because persistence is isolated behind one adapter, moving to Supabase (or
any backend) later mainly means changing `localStorageAdapter.ts`'s
implementation of `get`/`set`/`remove` to make network calls instead of
touching `window.localStorage` — the hooks and components that call it
wouldn't need to change. The pieces that would still need real work:

- Adding authentication (there is none in V1 — anyone opening the app in a
  browser gets their own local, unauthenticated state)
- Moving the per-key store model to a per-user schema in Postgres
- Deciding a sync strategy for state that currently assumes "one browser,
  one user" (e.g. merging seen-state across devices)

## Current limitations

- **No accounts / no cross-device sync.** State lives in one browser. Clear
  your browser data (or switch browsers/devices) and it's gone.
- **Live OpenAlex retrieval, `npm install`, and a running dev/build server
  were not exercised end-to-end during the Aug 2026 remediation pass**
  because this sandbox blocked essentially all outbound package-registry and
  API traffic (confirmed directly — every single package fetch in an
  `npm install` run failed the same way, not just one flagged package). The
  code was implemented and manually reviewed with care, and the OpenAlex
  filter/field usage was checked against OpenAlex's live documentation, but
  `npm run build`/`lint`/`dev` and live-browser verification of the five
  Prof. Zhou scenarios still need to be run once in an environment with
  normal internet access before shipping — see the PR description for the
  exact list.
- **Topic filtering was intentionally not built.** OpenAlex's topic/concept
  metadata isn't reliably populated for every work, and the brief explicitly
  said not to sacrifice core functionality for it.
- **No push notifications or email digests** — this is a pull-based feed you
  check when you want to.
- The 90-day retrieval window and per-request page caps are reasonable
  defaults, not tuned against real traffic volume for all 26 journals at
  once.
- OpenAlex's `type`/`is_retracted` classification (verified current as of
  2026-08-26) is itself imperfect — its July 2026 overhaul improved accuracy
  to ~78% against ground truth, up from ~69%, so a small amount of
  misclassified content may still slip through or be over-excluded. The
  `type:article|review` allowlist plus `is_retracted:false` is the best
  currently-available filter, not a guarantee of a perfectly clean corpus.

## Journal source mapping status

All 26 requested journals are in the catalog with print **and** online
ISSNs cross-checked against multiple independent sources (the ISSN
International Centre portal, publisher pages, Wikipedia) — no journal was
dropped, and no OpenAlex Source ID was hand-typed or guessed anywhere in the
codebase. Resolution from ISSN → OpenAlex Source ID happens **live, at
runtime**, via OpenAlex's own `/sources?filter=issn:...` endpoint, cached
independently per journal for 24h (see `src/lib/openalex/sources.ts`), and
any journal OpenAlex doesn't return a match for is surfaced directly in the
"Manage journals" dialog rather than silently dropped or faked.

As noted above, this live resolution step has not yet been exercised against
the real API in either build session due to sandbox network restrictions —
confirming it end-to-end (and noting here if any specific journal genuinely
fails to resolve against live OpenAlex data) is the first thing worth doing
once this runs somewhere with normal internet access.

## Future: deploying to Vercel

This is a standard Next.js App Router project, so it deploys to Vercel with
no configuration: connect the GitHub repo, accept the defaults, deploy. No
environment variables are required for V1 since there's no backend yet.

## Roadmap ideas beyond V1

- Supabase-backed accounts so seen-state and watchlists sync across devices
- Optional email/weekly-digest summaries of new articles
- Author-level or topic-level following, once OpenAlex's topic metadata is
  reliably populated across these journals
