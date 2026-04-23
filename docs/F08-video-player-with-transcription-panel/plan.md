# Implementation Plan: F08. Video Player with Transcription Panel

**Prerequisites:**
- Node.js (matching the Next.js 16 / React 19 scaffold already in `package.json`)
- Docker Desktop running locally (reuses the Postgres container stood up by F02 for dev, and the testcontainers-based Postgres for integration tests)
- F02, F03, F04, and F07 merged (provide the session reader, the `Video`/`Transcription`/`TranscriptionSegment`/`Summary`/`VideoJob` tables, `findVideoForUser`, `getVideoWithPipelineRelations`, `removeVideoDir`, the thumbnail Route Handler, the F04 detail-page placeholder at `app/app/videos/[id]/page.tsx`, the F04 reusable components `<RenameField />` / `<DescriptionModal />` / `<DeleteConfirmModal />` / `<StatusBadge />` / `<ContextMenu />` / `formatDuration`, and the F07 retry Route Handler `POST /api/videos/{id}/retry`)
- No new runtime dependencies are required; F08 uses native `<video>`, Tailwind v4, and the existing `zod`, `@prisma/client`, and session modules
- Environment variables (via `.env.local`, copied from `.env.example`): `DATABASE_URL`, `SESSION_SECRET`, `VIDEO_STORAGE_ROOT`, `VIDEO_MAX_BYTES` (all already defined by F02 / F03)
- Vitest unit + integration projects from F02 (extended by F03, F04, F07); Playwright config from the existing `playwright.config.ts`; the reference video fixture at `video-sample/video-test.mkv` called out in CLAUDE.md; the per-session database naming workflow defined in CLAUDE.md

---

### Stage 1: Streaming Backend and Detail DTO

**1. Range parser and streaming storage helpers** - Introduce `app/_lib/player/range.ts` with the pure `parseRangeHeader` function that translates an HTTP `Range` header into a `{ start, end }` slice, `'missing'`, or `'invalid'` per the RFC 7233 rules described in the spec, and extend `app/_lib/videos/storage.ts` with `statVideoSource` and `readVideoSourceRange` so the new handler can resolve file size and open a bounded `ReadStream` inside `VIDEO_STORAGE_ROOT` without risking path traversal.

**2. Video streaming Route Handler** - Introduce `app/api/videos/[id]/stream/route.ts` as the Node-runtime `GET` handler that mirrors the thumbnail handler's session + ownership check pattern, maps `video.containerFormat` to the correct `Content-Type`, parses the request's `Range` header through the Stage 1 helper, and returns `200` / `206` / `416` / `404` exactly as prescribed by the spec's API Contracts section.

**3. Detail DTO builder** - Introduce `app/_lib/videos/detail.ts` exposing `toVideoDetailDTO(row)` that consumes F07's `getVideoWithPipelineRelations` result, serializes every field the client needs on first paint (video metadata, ordered segments, normalized detected language, summary existence, stream + thumbnail URLs, pipeline stage label, last-error fields) into a single `VideoDetailDTO` shape, and covers the still-processing, failed, and ready branches described in the spec's Technical Overview.

### Stage 2: Client Player Primitives

**4. Player primitive helpers** - Introduce `app/_lib/player/timing.ts` with the binary-search `findActiveSegmentIndex` and the `clampSeek` helper, and `app/_lib/player/language.ts` with the `normalizeLanguageLabel` mapper, each pure and fully unit-tested so the visible-playback logic is built on a verifiable base.

**5. Player controller context** - Introduce `app/_lib/player/controller.ts` exporting the React context, the `PlayerControllerProvider` component that owns the `<video>` ref and the derived state (`currentTime`, `duration`, `isPlaying`, `activeSegmentIndex`), the `usePlayerController` hook with the out-of-provider guard, the `VideoSegmentDTO` type, and the `seekTo` / `togglePlay` / `focusPanelSegment` methods so F09 and F10 can consume the same hook without importing any component internals.

**6. Native video element wiring** - Introduce `app/_components/player/VideoPlayer.tsx` that renders the native HTML5 `<video>` with `src`, `preload='metadata'`, and `playsInline`, binds the element's imperative surface to the Stage 5 controller, and wires the `onTimeUpdate`, `onDurationChange`, `onPlay`, `onPause`, `onEnded`, and `onError` events into the state described in the spec's Component Overview.

**7. Custom control bar** - Introduce `app/_components/player/PlayerControlBar.tsx` with the play/pause button, the current-time / total-time readout using the existing `formatDuration` helper, the seek range input, the volume slider with mute toggle (persisting the last value to `localStorage` per the spec's Technical Decisions), the playback-speed selector with the exact values enumerated in the PRD, and the fullscreen toggle that targets the shell container so the custom controls stay visible.

**8. Keyboard shortcut installer** - Introduce `app/_components/player/PlayerKeyboardShortcuts.tsx` that registers a shell-scoped `keydown` listener, applies the focus-gating predicate (ignores events originating from form fields and only fires when `document.activeElement` is inside `data-player-area` or the shell is focused), and dispatches Space to `togglePlay`, ArrowLeft to `seekTo(currentTime - 5)`, and ArrowRight to `seekTo(currentTime + 5)` exactly as described in the spec's keyboard-gating data flow.

### Stage 3: Transcription Panel

**9. Segment item and virtualized list** - Introduce `app/_components/player/TranscriptionSegmentItem.tsx` as the presentational row showing `MM:SS` timestamp + text with an `onClick` that calls `seekTo(startSeconds, { playAfter: true })` and marks the item active via `data-active`, plus `app/_components/player/VirtualizedSegmentList.tsx` as the in-house windowed renderer activated above the threshold defined in the spec.

**10. Transcription panel with auto-scroll and manual-scroll suspension** - Introduce `app/_components/player/TranscriptionPanel.tsx` as the fixed-height scroll container that hosts the segment list (virtualized or not), drives auto-scroll toward the centered active segment when the panel is not user-scrolled, implements the refs-based `ignoreNextScroll` counter + 16 px drift threshold to detect deliberate user scrolls, and re-engages auto-scroll on segment click or on paused-to-playing transition per the spec's Experience rules.

**11. Language badge** - Introduce `app/_components/player/LanguageBadge.tsx` as the small pill near the panel heading that reads the normalized detected-language label from the controller and falls back to the dash glyph for null values.

### Stage 4: Detail Page Shell and Branches

**12. Detail header** - Introduce `app/_components/player/DetailHeader.tsx` that composes the back link, the status badge, the inline-rename title (reusing F04's `<RenameField />`), the description edit trigger (reusing F04's `<DescriptionModal />`), the folder label slot (no-op until F05 lands), the tag chip slot (no-op until F06 lands), the Retry action (only on failed) wired to F07's retry endpoint with a follow-up `router.refresh`, and the Delete action (reusing F04's `<DeleteConfirmModal />`).

**13. Processing and failed state cards** - Introduce `app/_components/player/ProcessingStageCard.tsx` that renders the current pipeline stage label, the PRD "Transcription will appear here when processing completes" copy, and the 5-second `router.refresh` interval, and `app/_components/player/FailedStateCard.tsx` that renders the failure reason from the DTO, the Retry button, and the Delete trigger as described in the spec.

**14. Summary placeholder slot** - Introduce `app/_components/player/SummaryPlaceholder.tsx` as the named slot beneath the player column; it renders nothing visible when `hasSummary === false` on processing videos and a "Summary will appear here" card on ready-but-not-yet-summarized rows so F10 can replace it cleanly in its own wave.

**15. Player shell and error boundary** - Introduce `app/_components/player/PlayerShell.tsx` as the single `"use client"` island that wraps everything in the Stage 5 controller provider, renders `<VideoPlayer />`, `<PlayerControlBar />`, `<TranscriptionPanel />`, `<SummaryPlaceholder />`, and `<PlayerKeyboardShortcuts />` inside a `data-player-area` container that tracks click-based focus, and wraps the media element in `app/_components/player/PlayerErrorBoundary.tsx` to fall back gracefully on media errors.

**16. Detail RSC assembly** - Modify `app/app/videos/[id]/page.tsx` to replace the F04 placeholder body with the full three-region layout: keep the existing session + `findVideoForUser` guards but upgrade to `getVideoWithPipelineRelations` and `toVideoDetailDTO`, render `<DetailHeader />` on every status, and branch the main body into `<ProcessingStageCard />` / `<FailedStateCard />` / `<PlayerShell />` based on the DTO's `status` field.

### Stage 5: Test Coverage and End-to-End Validation

**17. Unit tests for helpers, the controller, and every component** - Implement the unit tests listed in the spec's Testing Strategy for the range parser, the timing helpers, the language normalizer, the detail DTO mapper, the storage range helpers (against a tmpdir), the controller provider + hook, the video element wiring, the control bar, the keyboard shortcut installer, the transcription panel with its auto-scroll and manual-scroll suspension logic, the segment item, the virtualized list, the language badge, the processing and failed cards, the detail header, the summary placeholder, and the player shell so every branch described in the spec has an associated test.

**18. Integration tests for the stream handler and the detail RSC** - Implement the integration tests listed in the spec for the `/api/videos/[id]/stream` Route Handler (200 full body, 206 slice, 206 open-ended, 206 suffix, 416 malformed, 416 out-of-bounds, 404 unauthenticated, 404 non-owner, 404 missing file, content-type matching the container) against `testcontainers` Postgres plus a tmpdir source, and the detail RSC (ready → shell, each processing status → stage card, failed → failed card, non-owner → `notFound`, unauthenticated → redirect, DTO passthrough to the shell) against the same harness.

**19. Playwright coverage of the user-visible acceptance criteria** - Implement `e2e/video-detail.spec.ts` seeded with the `video-sample/video-test.mkv` fixture to cover the PRD Section 9 F08 user-visible criteria — three-region layout, click-to-seek, space / arrow shortcuts, active segment highlight, auto-scroll while playing, manual scroll suspends auto-scroll and is resumed by a segment click, detected-language label visible, still-processing branch renders the current stage, failed branch renders the Retry button — so every DOM-dependent acceptance criterion has an end-to-end check that runs against the dev server on the session's assigned port.
