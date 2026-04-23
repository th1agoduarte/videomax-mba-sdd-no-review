# Implementation Plan: F11. In-App Processing Notifications

**Prerequisites:**
- Node.js (matching the Next.js 16 / React 19 scaffold already in `package.json`)
- Docker Desktop running locally (reuses the Postgres container stood up by F02 for dev, and the testcontainers-based Postgres for integration tests)
- F02 merged (provides `getSession()`, the `User` table, Prisma client singleton, cookie helpers, Server Action conventions, integration test harness)
- F03 merged (provides the client-side `UploadQueue` singleton, `VideoDTO`, the thumbnail Route Handler, the upload drop zone and progress list already mounted on `/app`)
- F04 merged (provides the `<LibraryClient />` island F11 will extend with a store subscription so the grid/list refreshes automatically)
- F07 merged (provides the `video_event` append-only log, the `notify_video_event()` trigger on channel `video_events`, the `subscribeToVideoEvents({ userId?, videoId?, signal })` multiplexer, the per-video SSE Route Handler, the `pg` runtime dependency, and the `instrumentation.ts` bootstrap that starts the LISTEN client in the Node.js runtime)
- No new runtime dependencies are required; F11 reuses `@prisma/client`, `zod`, `pg` (already pulled in by F07 for LISTEN/NOTIFY), `next/navigation`, and browser-native `EventSource`
- Environment variables (via `.env.local`, copied from `.env.example`): `DATABASE_URL`, `SESSION_SECRET`, `VIDEO_STORAGE_ROOT`, and the pipeline variables already defined by F07; F11 introduces no new env variables
- Vitest unit + integration projects from F02 (extended by F03/F04/F07); Playwright config from the existing `playwright.config.ts`; CLAUDE.md workflow for per-session database naming

---

### Stage 1: Persistence and Server Surfaces

**1. User auto-open flag migration** - Extend `prisma/schema.prisma` with the new `notificationsAutoOpened` boolean column described in the spec's Data Model section on the existing `User` model and generate the `add_user_notifications_auto_opened` migration so every user has a durable, per-account flag to gate the first-successful-upload auto-open behavior without a separate preferences table or local-storage fallback.

**2. Notifications repository and DTO mapper** - Introduce `app/_lib/notifications/notificationsRepository.ts` with `listRecentTerminalsForUser(userId, since)` (the indexed join over `video_event` and `video` described in the spec) and `markNotificationsAutoOpened(userId)`, plus `app/_lib/notifications/notificationsDTO.ts` with the `toNotificationEntryDTO` mapper so the server, the client store, and the tests agree on a single `NotificationEntryDTO` shape.

**3. User-scoped SSE Route Handler** - Introduce `app/api/videos/events/route.ts` as a Node-runtime `GET` Route Handler that authenticates via `getSession()`, opens `subscribeToVideoEvents({ userId, signal })` against F07's LISTEN/NOTIFY bridge, streams each transition as an `event: status` SSE line, emits a keepalive comment every 20 s, and closes cleanly on client disconnect so a single EventSource per tab carries every status change for the current user without duplicating the per-video endpoint.

**4. Recent terminals Route Handler** - Introduce `app/api/videos/notifications/recent/route.ts` as a Node-runtime `GET` Route Handler that authenticates, calls the Stage 1 repository with a `NOW() - INTERVAL '60 minutes'` floor, and returns the `entries` JSON array described in the spec's API Contracts so the panel hydrates immediately on mount without waiting for the SSE stream to produce a replay.

**5. Auto-open Server Action** - Introduce `app/_lib/notifications/actions.ts` with the `markNotificationsAutoOpened` Server Action that performs the session check and flips the new `user` column via the repository so the panel can persist the one-time introduction signal on the first successful upload without depending on client storage.

### Stage 2: Client Store and Merge Rules

**6. Pure merge, prune, and sort helpers** - Introduce `app/_lib/notifications/mergeRules.ts` with the pure functions described in the spec (`mergeUploadItem`, `mergeStatusEvent`, `pruneTerminals`, `sortEntries`) so every merge path between upload-queue items, SSE events, and the rolling 60-minute window is covered by deterministic, React-free unit tests before any UI is wired.

**7. Notifications store singleton** - Introduce `app/_lib/notifications/notificationsStore.ts` as a module-singleton mirroring F03's `UploadQueue` pattern, wrapping the Stage 2.6 merge rules with a `subscribe` / `getSnapshot` / `dismiss` / `setCollapsed` / `onVideoChanged` API; rekey upload entries from `upload:<queueId>` to `video:<videoId>` on the queue `done` transition and emit `onVideoChanged(videoId)` whenever an entry is inserted or its status advances so downstream consumers (the library island) can react without polling.

**8. Wiring hook** - Introduce `app/_components/notifications/useNotifications.ts` as the single source of wiring: on mount it fetches the Stage 1 recent endpoint to seed the store, opens an `EventSource` against the Stage 1 SSE endpoint and forwards each message into the store, subscribes to F03's `getUploadQueue()` singleton and forwards every snapshot change into the store, starts a 30-second pruner timer, and returns the `{ entries, activeCount, isCollapsed, setCollapsed, dismiss }` surface the panel renders; every resource is torn down on unmount.

### Stage 3: Panel UI and Layout Integration

**9. Presentational entry and progress components** - Introduce `app/_components/notifications/NotificationEntry.tsx` as the single-row presenter (thumbnail or placeholder, title, status chip, progress indicator, dismiss `×` on terminal states, keyboard-accessible click into `/app/videos/{id}`) and `app/_components/notifications/ProgressIndicator.tsx` with the four visual modes described in the spec (bar for upload, spinner for processing stages, check for ready, error pill for failed) so every status has a dedicated, testable renderer.

**10. List and collapsed toggle** - Introduce `app/_components/notifications/NotificationsList.tsx` with the header (active-count + collapse button) and scrollable body, and `app/_components/notifications/NotificationsToggle.tsx` with the round collapsed-state button and numeric badge, both purely presentational and driven by props so the container component owns the actual state transitions.

**11. Panel container and auto-open state machine** - Introduce `app/_components/notifications/NotificationsPanel.tsx` as the single `"use client"` island that consumes `useNotifications()`, owns the manual-collapse override, renders the list when there are entries and the expanded state is active (or the toggle otherwise), and fires the Stage 1.5 Server Action exactly once on the first upload-done transition when the server-supplied `initialAutoOpened` prop is `false`; document the z-index layer so the panel sits above modals and below future toasts.

**12. Authenticated layout and panel mount** - Introduce `app/app/layout.tsx` as the authenticated route-group layout that calls `getSession()` (redirecting unauthenticated users per the existing page-level pattern), renders its children, and mounts `<NotificationsPanel initialAutoOpened={...} />` so the panel persists across client-side navigations between `/app` and `/app/videos/:id` without mounting on the admin or public surfaces.

### Stage 4: Library Freshness Integration

**13. Library client subscribes to the notifications store** - Modify `app/_components/library/LibraryClient.tsx` to subscribe to the Stage 2.7 store's `onVideoChanged` callback via a `useEffect` and call `router.refresh()` on every emission so the grid/list reflects new uploads and subsequent stage transitions within ≤ 2 s without a manual reload, closing the gap left open between F03 (inserts the row) and F04 (reads once on first paint).

### Stage 5: Test Coverage and End-to-End Validation

**14. Unit tests for merge rules, store, DTO, and components** - Implement the unit tests listed in the spec's Testing Strategy for `mergeRules`, the `NotificationsStore`, the `notificationsDTO` mapper, the presentational components (`NotificationEntry`, `NotificationsList`, `NotificationsToggle`, `ProgressIndicator`), the container (`NotificationsPanel`) including the auto-open one-shot, and the wiring hook (`useNotifications`) with mocked `EventSource`, upload queue, and timers so every branch described in the spec has an associated test before the panel ships.

**15. Integration tests for repository, Server Action, and HTTP surfaces** - Implement the integration tests listed in the spec for `listRecentTerminalsForUser` (window, ownership, ordering, join), `markNotificationsAutoOpened` (DB + Server Action paths), the user-scoped SSE Route Handler (auth, owner-only filter, keepalive, end-to-end latency under one second, abort cleanup), and the recent-terminals Route Handler (auth, empty user, populated user) so the PRD's "within approximately one second" latency requirement and every owner-filter boundary have explicit, CI-reproducible coverage against the testcontainers Postgres.

**16. Library-client regression test** - Extend `app/_components/library/__tests__/LibraryClient.test.tsx` with an assertion that the island subscribes to the notifications store and invokes `router.refresh()` when `onVideoChanged` emits so the Stage 4 integration cannot regress without a red unit test, independent of the Playwright suite.

**17. Playwright coverage of the user-visible acceptance criteria** - Implement `e2e/notifications.spec.ts` to cover the PRD Section 9 F11 criteria that depend on DOM or navigation — the panel appearing anchored bottom-right on both `/app` and `/app/videos/:id`, the uploading entry appearing on drop, the entry advancing stages within roughly one second without reload, click-to-open navigation, individual dismissal, empty-state collapse, first-upload auto-open, and the F11-owned library freshness flows (card appearing within ≤ 2 s of upload completion and badge transitioning without reload) — so every user-visible acceptance criterion has an end-to-end check that runs against the dev server on the session's assigned port.
