# Implementation Plan: F06. Tag Organization

**Prerequisites:**
- Node.js (matching the Next.js 16 / React 19 scaffold already in `package.json`)
- Docker Desktop running locally (reuses the Postgres container stood up by F02 for dev, and the testcontainers-based Postgres for integration tests)
- F02 merged (provides `getSession()`, the `User` table, Prisma client singleton, cookie helpers, Server Action conventions, integration test harness)
- F03 merged (provides the `Video` table, `findVideoForUser`, ownership patterns)
- F04 merged (provides the library RSC at `/app`, `LibraryClient`, `VideoCard`, `VideoRow`, `ContextMenu`, `libraryRepository`, `libraryErrors` / `libraryValidation` style, and the Playwright/Vitest harness)
- No new runtime dependencies are required; F06 reuses `zod`, `@prisma/client`, and the Tailwind theme tokens already in place
- Environment variables (via `.env.local`, copied from `.env.example`): `DATABASE_URL`, `SESSION_SECRET` (already defined by F02)
- Vitest unit + integration projects from F02; Playwright config from the existing `playwright.config.ts`; CLAUDE.md workflow for per-session database naming

---

### Stage 1: Persistence and Domain Primitives

**1. Tag schema, join table, and migration** - Add the `Tag` and `VideoTag` models to `prisma/schema.prisma` with the relation fields on `User` and `Video` described in the spec's Data Model section, and generate the `add_tags` migration that creates both tables with their indexes, FKs, CHECK constraints, and the per-user unique-name index so the many-to-many backbone exists before any code imports it.

**2. Validation, canonicalization, and error primitives** - Introduce `app/_lib/tags/validation.ts` with the `canonicalizeTagName` helper, the name regex, the per-video cap constant, the zod schemas consumed by every Server Action (`tagNameSchema`, `createTagSchema`, `renameTagSchema`, `deleteTagSchema`, `setVideoTagsSchema`, `tagFilterQuerySchema`), and `app/_lib/tags/errors.ts` with the typed error codes and human-readable messages that mirror F04's `libraryErrors` pattern.

**3. Ownership-scoped tag repository** - Introduce `app/_lib/tags/repository.ts` with the Prisma accessors described in the spec — listing tags per user, listing tags per video, listing tags with video counts, finding a tag by `(user_id, name)`, idempotent create-for-user, ownership-scoped rename and delete (each transactional and each returning useful counts), the transactional `setVideoTagsForUser` that diffs the current tag set against the requested set in a single round trip, and `listVideoIdsMatchingTagFilter` for the library filter.

**4. Library repository extension for filter composition** - Extend `app/_lib/videos/libraryRepository.ts`'s `listByUser` with an optional `filter` parameter carrying `{ folderId?, tagIds? }`, using Prisma's `some` to apply OR-within-tags and `AND` to compose with any folder predicate exactly as the spec prescribes; update `app/_lib/videos/library.ts` to accept the same filter, return the new `VideoListItemWithTagsDTO`, and expose the per-video tag map the RSC hands to the client island.

### Stage 2: Server Actions and Routing

**5. Server Actions for tag mutations** - Introduce `app/_lib/tags/actions.ts` with the five Server Actions listed in the spec's API Contracts section — `createTag`, `renameTag`, `deleteTag`, `setVideoTags`, and `fetchTagSuggestions` — each reading the session, validating input with the Stage 1 schemas, delegating to the Stage 1 repository, returning a typed `ActionState`, and calling `revalidatePath('/app')` and `revalidatePath('/app/tags')` so both surfaces stay fresh after any mutation.

**6. Library RSC wiring and Manage-tags route** - Modify `app/app/page.tsx` to read `searchParams.tags`, load the full tag list and the per-video tag map alongside the filtered items, and pass the new props into `LibraryClient` additively, and introduce `app/app/tags/page.tsx` as a session-guarded Server component that calls `listTagsWithCountsForUser` and renders `<ManageTagsClient />` so the Manage view exists as its own route.

### Stage 3: Client Experience — Combobox, Chips, Filter, Modals, Manage View

**7. Tag combobox and chip components** - Introduce `app/_components/tags/TagCombobox.tsx` as the reusable client combobox that handles typeahead against the seeded tag list, inline `Create tag "x"` rendering, chip add/remove, the 20-tag cap, keyboard navigation, and optimistic state, plus `app/_components/tags/TagChips.tsx` for the presentational up-to-3-plus-overflow chip row used on the library card and row.

**8. Library header filter pill row and card/row slot wiring** - Introduce `app/_components/tags/TagFilterPillRow.tsx` that toggles tag ids in the URL via `router.replace` and renders a `Clear tags` link while any tag is active, and extend `app/_components/library/VideoCard.tsx` + `app/_components/library/VideoRow.tsx` with an optional `tagsSlot` prop so `<TagChips />` can be injected without F06 owning the card/row layout; update `app/_components/library/ContextMenu.tsx` to expose the new `Edit tags` entry.

**9. Edit-tags modal and LibraryClient integration** - Introduce `app/_components/tags/EditTagsModal.tsx` that wraps `<TagCombobox />` for a single video and posts `setVideoTags` on Save with optimistic chip updates, and modify `app/_components/library/LibraryClient.tsx` to accept the new tag props, render the filter pill row, feed chips into each card/row via the Stage 8 slot, and host the Edit-tags modal from the context menu entry.

**10. Manage tags view components** - Introduce `app/_components/tags/ManageTagsClient.tsx` as the client island for `/app/tags` that renders one row per tag with its video count, `app/_components/tags/RenameTagField.tsx` for the inline rename editor, and `app/_components/tags/DeleteTagModal.tsx` for the delete confirmation whose copy includes the removed-from-count so the user sees the blast radius before confirming.

### Stage 4: Test Coverage and End-to-End Validation

**11. Unit tests for validation, components, and optimistic flows** - Implement the unit tests listed in the spec's Testing Strategy for `validation.ts`, `TagCombobox`, `TagChips`, `TagFilterPillRow`, `EditTagsModal`, `ManageTagsClient`, `RenameTagField`, and `DeleteTagModal`, so every branch described in the spec — canonicalization, regex rejections, cap enforcement, chip overflow, URL toggle, optimistic rollback — has a direct test.

**12. Integration tests for the repository, actions, and library RSC tag filter** - Implement the integration tests listed in the spec for `app/_lib/tags/repository.integration.test.ts`, `app/_lib/tags/actions.integration.test.ts`, `app/_lib/videos/__tests__/libraryRepository.tagFilter.integration.test.ts`, and the `/app?tags=...` + `/app/tags` RSC tests, each running against the F02 testcontainers Postgres with the existing session mock helper and covering every PRD Section 9 F06 criterion plus the AND-of-folder / OR-of-tags composition.

**13. Playwright coverage of the user-visible acceptance criteria** - Implement `e2e/tags.spec.ts` to cover the PRD Section 9 F06 criteria that depend on DOM or navigation — creating a tag from the combobox and attaching it, filtering the library by one or more tags (OR), renaming a tag and seeing the new name propagate across every video, deleting a tag and seeing it disappear from every video without losing the videos, and the combobox's reject-space / lowercase-on-type rules — so every user-visible acceptance criterion has an end-to-end check that runs against the dev server on the session's assigned port.
