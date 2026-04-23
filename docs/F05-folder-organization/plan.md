# Implementation Plan: F05. Folder Organization

**Prerequisites:**
- Node.js (matching the Next.js 16 / React 19 scaffold already in `package.json`)
- Docker Desktop running locally (reuses the Postgres container stood up by F02 for dev, and the testcontainers-based Postgres for integration tests)
- F02 merged (provides `getSession()`, the `User` table, Prisma client singleton, cookie helpers, Server Action conventions, integration test harness)
- F03 merged (provides the `Video` table, `VideoDTO`, ownership accessors, `findVideoForUser`)
- F04 merged (provides `app/app/page.tsx` library shell, `LibraryClient`, `ContextMenu`, `VideoListItemDTO`, `EmptyState`, `listVideosForUser`, `libraryRepository.listByUser`, Server-Action + Zod + error-code module layout, `e2e/library.spec.ts` helpers)
- No new runtime dependencies are required; F05 reuses `zod`, `@prisma/client`, the Tailwind theme tokens, and the in-house popover pattern from F04's `ContextMenu`
- Environment variables (via `.env.local`, copied from `.env.example`): `DATABASE_URL`, `SESSION_SECRET`, `VIDEO_STORAGE_ROOT`, `VIDEO_MAX_BYTES` (all already defined by F02/F03; F05 adds none)
- Vitest unit + integration projects from F02; Playwright config from the existing `playwright.config.ts`; CLAUDE.md workflow for per-session database naming

---

### Stage 1: Persistence and Domain Module

**1. Folder model, video FK, and migration** - Extend `prisma/schema.prisma` with the new `Folder` model plus the nullable `folderId` field and reciprocal relation on the existing `Video` model and `User` model, then generate the `add_folders` migration that creates the `folder` table with its primary key, CHECK constraint on `name` length, foreign key to `user` with cascade delete, supporting `(user_id, name)` index, and the `lower(name)`-expression unique index described in the spec's Data Model section; the same migration adds the nullable `folder_id` column to `video`, the `ON DELETE SET NULL` foreign key, and the `(user_id, folder_id, created_at DESC)` index so folder-filtered listings stay index-only.

**2. Folder domain primitives** - Introduce `app/_lib/folders/errors.ts` with the typed error codes consumed by every Server Action, `app/_lib/folders/validation.ts` with the Zod schemas each action uses, and `app/_lib/folders/dto.ts` with the `FolderDTO`, `FolderSidebarDTO`, and the `parseFolderFilter` / `resolveFolderFilter` helpers the RSC uses to coerce the `?folder=` URL param against the user's real folder list with a safe fallback.

**3. Folder repository** - Introduce `app/_lib/folders/repository.ts` with the ownership-scoped Prisma accessors described in the spec — listing folders with per-folder video counts, creating folders while mapping Prisma's `P2002` violation to the `FOLDER_NAME_DUPLICATE` code, renaming with the same duplicate-mapping, deleting with a transaction that relies on the `ON DELETE SET NULL` foreign key to return contained videos to Unfiled, and assigning a video to a folder (or to Unfiled when the target is null) with both the folder and video ownership checks.

**4. Library query extension** - Extend `app/_lib/videos/library.ts` and `app/_lib/videos/libraryRepository.ts` so `listVideosForUser` accepts the `{ folderFilter, tagFilter? }` pair described in the spec and threads the right Prisma `where` clause through, expose the new `countForAllFilters(userId)` aggregator returning all/unfiled/per-folder counts in one `groupBy` query, and add `folderId` to `VideoListItemDTO` so the client island can reflect reassignment optimistically.

### Stage 2: Server Actions and Library Integration

**5. Folder Server Actions** - Introduce `app/_lib/folders/actions.ts` with the four Server Actions described in the spec's API Contracts section — `createFolder` (including the combined create-and-assign flow used by the combobox), `renameFolder`, `deleteFolder` (returning the conditional `redirectTo` when the deleted folder was the active filter), and `assignVideoToFolder` (accepting both a real folder id and the empty-string "Unfiled" signal) — each reading the session, validating with Stage 1's schemas, delegating to the Stage 1 repository, calling `revalidatePath('/app')`, and returning a typed state aligned with the library action pattern from F04.

**6. Library RSC folder integration** - Modify `app/app/page.tsx` to read the `?folder=` search param via `resolveFolderFilter`, load the user's folders through `listFoldersForUser`, feed both the folder filter and the folder sidebar into `listVideosForUser`, and render the new `<FolderSidebar />` alongside the existing `<LibraryClient />` so the library now ships with the folder navigation and count badges on its first paint.

### Stage 3: Sidebar, Combobox, and Library Client Wiring

**7. Sidebar shell and client island** - Introduce `app/_components/library/FolderSidebar.tsx` as the server-rendered sidebar described in the spec — fixed "All videos" and "Unfiled" entries on top, the user's folders alphabetically below, video counts as small badges, `aria-current="page"` on the selected entry, and `<Link>`-based navigation through the `?folder=` param — and `app/_components/library/FolderSidebarClient.tsx` as the `"use client"` island that owns the inline create input state, the per-folder kebab menu hosting Rename and Delete, and the localStorage-backed collapse toggle.

**8. Inline create, rename, and delete components** - Introduce `app/_components/library/InlineCreateFolder.tsx`, `app/_components/library/FolderRenameField.tsx`, and `app/_components/library/FolderDeleteConfirmModal.tsx` as the three interactive slices the sidebar needs — Enter-to-confirm with inline duplicate/empty error handling for the create input, F04-style inline editable field with Escape-to-cancel for rename, and a confirmation modal with the exact PRD copy "Delete folder '{name}'? Its videos will move to Unfiled." that honors the Server Action's `redirectTo` field when the deleted folder was the active filter.

**9. Folder combobox** - Introduce `app/_components/library/FolderCombobox.tsx` as the popover invoked from the card context menu — listing the Unfiled option and the user's folders, supporting case-insensitive type-ahead filtering, rendering an inline "Create new folder '{query}'" row when no folder matches (which invokes `createFolder` with `assignVideoId` so creation and assignment happen in one transaction), and full keyboard navigation (Up/Down/Enter/Escape) matching F04's `ContextMenu` accessibility contract.

**10. Library client folder integration** - Modify `app/_components/library/LibraryClient.tsx` to receive the new `folders` and `folderFilter` props, extend the `buildMenu` function so every card's context menu gains the "Move to folder" item that opens `<FolderCombobox />`, and add the optimistic-update logic described in the spec so `folderId` flips immediately on assign and rolls back if the Server Action fails.

**11. Empty state context** - Modify `app/_components/library/EmptyState.tsx` to accept the new `context` prop described in the spec so the zero-row view renders the library copy when no folder is selected, the folder-specific copy when a specific folder is active, and the Unfiled copy when every video is already filed, while still rendering the F03 drop zone in every context.

### Stage 4: Test Coverage and End-to-End Validation

**12. Unit tests for folder domain and library extensions** - Implement the unit tests listed in the spec's Testing Strategy for the validation schemas, DTO coercers, `listVideosForUser` folder-filter dispatch including the `folderId` addition to the DTO, and every new component (sidebar, sidebar client, inline create, rename field, delete modal, combobox, updated library client) so every branch described in the spec has an associated test.

**13. Integration tests for the repository, Server Actions, and library RSC** - Implement the integration tests listed in the spec for the folder repository (ownership-scoped reads and writes, `P2002` duplicate mapping, case-insensitive uniqueness, `ON DELETE SET NULL` cascade), every Server Action (happy + error matrix including the active-filter redirect and the combined create-and-assign flow), the library repository additions (folder filter, `countForAllFilters`, AND composition with the pass-through tag filter), and the `/app` RSC branches (filter all/unfiled/by-id, unknown folder fallback, sidebar counts) against the F02 testcontainers Postgres with the existing session mock helper.

**14. Playwright coverage of the user-visible acceptance criteria** - Implement `e2e/folders.spec.ts` to cover the PRD Section 9 F05 criteria that depend on DOM or navigation — creating a folder from the sidebar, moving a video via the card context menu, the combobox's inline create-and-move flow, sidebar navigation filtering the library, renaming updating the sidebar entry immediately, deleting a folder moving its videos to Unfiled, the redirect-to-all behaviour when the deleted folder was the active filter, and the inline duplicate-name rejection — so every user-visible acceptance criterion has an end-to-end check that runs against the dev server on the session's assigned port.
