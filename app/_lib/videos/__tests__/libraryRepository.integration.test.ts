import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/app/_lib/db";
import {
  deleteOwnedVideo,
  listByUser,
  readLibraryPreferences,
  resetToValidating,
  updateDescription,
  updateLibraryPreferences,
  updateTitle,
} from "../libraryRepository";

async function makeUser(suffix: string) {
  return prisma.user.create({
    data: {
      email: `lib-${suffix}@example.com`,
      name: `User ${suffix}`,
      passwordHash:
        "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
}

async function seedVideo(
  userId: string,
  title: string,
  overrides: Partial<{
    status: string;
    createdAt: Date;
    folderId: string | null;
  }> = {},
) {
  return prisma.video.create({
    data: {
      userId,
      title,
      originalFilename: `${title}.mp4`,
      sizeBytes: BigInt(1024),
      containerFormat: "mp4",
      storagePath: `${userId}/__seed__/source.mp4`,
      status: overrides.status ?? "ready",
      ...(overrides.folderId !== undefined ? { folderId: overrides.folderId } : {}),
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

beforeEach(async () => {
  await prisma.video.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("libraryRepository - listByUser", () => {
  it("list_by_user_returns_only_owner_rows", async () => {
    const owner = await makeUser("owner");
    const other = await makeUser("other");
    await seedVideo(owner.id, "mine");
    await seedVideo(other.id, "theirs");
    const rows = await listByUser(owner.id, "recent");
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("mine");
  });

  it("list_by_user_sort_recent_is_default_and_newest_first", async () => {
    const owner = await makeUser("owner");
    await seedVideo(owner.id, "old", {
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    await seedVideo(owner.id, "new", {
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    const rows = await listByUser(owner.id, "recent");
    expect(rows.map((r) => r.title)).toEqual(["new", "old"]);
  });

  it("list_by_user_sort_oldest_is_oldest_first", async () => {
    const owner = await makeUser("owner");
    await seedVideo(owner.id, "new", {
      createdAt: new Date("2025-01-01T00:00:00Z"),
    });
    await seedVideo(owner.id, "old", {
      createdAt: new Date("2024-01-01T00:00:00Z"),
    });
    const rows = await listByUser(owner.id, "oldest");
    expect(rows.map((r) => r.title)).toEqual(["old", "new"]);
  });

  it("list_by_user_sort_title_asc_is_alphabetical", async () => {
    const owner = await makeUser("owner");
    await seedVideo(owner.id, "banana");
    await seedVideo(owner.id, "Apple");
    await seedVideo(owner.id, "cherry");
    const rows = await listByUser(owner.id, "title_asc");
    expect(rows.map((r) => r.title)).toEqual(["Apple", "banana", "cherry"]);
  });

  it("list_by_user_folder_unfiled_excludes_filed_videos", async () => {
    const owner = await makeUser("folder-unfiled");
    const folder = await prisma.folder.create({
      data: { userId: owner.id, name: "Courses" },
    });
    await seedVideo(owner.id, "filed", { folderId: folder.id });
    await seedVideo(owner.id, "unfiled");
    const rows = await listByUser(owner.id, "recent", {
      folderFilter: { kind: "unfiled" },
    });
    expect(rows.map((row) => row.title)).toEqual(["unfiled"]);
  });

  it("list_by_user_folder_by_id_returns_only_that_folder_rows", async () => {
    const owner = await makeUser("folder-id");
    const a = await prisma.folder.create({ data: { userId: owner.id, name: "A" } });
    const b = await prisma.folder.create({ data: { userId: owner.id, name: "B" } });
    await seedVideo(owner.id, "a-video", { folderId: a.id });
    await seedVideo(owner.id, "b-video", { folderId: b.id });
    const rows = await listByUser(owner.id, "recent", {
      folderFilter: { kind: "folder", folderId: a.id },
    });
    expect(rows.map((row) => row.title)).toEqual(["a-video"]);
  });

  it("count_for_all_filters_returns_aggregates", async () => {
    const owner = await makeUser("counts");
    const folder = await prisma.folder.create({
      data: { userId: owner.id, name: "Courses" },
    });
    await seedVideo(owner.id, "filed", { folderId: folder.id });
    await seedVideo(owner.id, "unfiled");
    const { countForAllFilters } = await import("../libraryRepository");
    await expect(countForAllFilters(owner.id)).resolves.toEqual({
      all: 2,
      unfiled: 1,
      perFolder: { [folder.id]: 1 },
    });
  });
});

describe("libraryRepository - mutations", () => {
  it("update_title_returns_null_for_non_owner", async () => {
    const owner = await makeUser("owner");
    const other = await makeUser("other");
    const video = await seedVideo(owner.id, "mine");
    const result = await updateTitle(video.id, other.id, "hijacked");
    expect(result).toBeNull();
    const fresh = await prisma.video.findUnique({ where: { id: video.id } });
    expect(fresh?.title).toBe("mine");
  });

  it("update_title_persists_value", async () => {
    const owner = await makeUser("owner");
    const video = await seedVideo(owner.id, "old");
    const result = await updateTitle(video.id, owner.id, "shiny new title");
    expect(result?.title).toBe("shiny new title");
  });

  it("update_description_persists_empty_string", async () => {
    const owner = await makeUser("owner");
    const video = await seedVideo(owner.id, "x");
    await updateDescription(video.id, owner.id, "");
    const fresh = await prisma.video.findUnique({ where: { id: video.id } });
    expect(fresh?.description).toBe("");
  });

  it("delete_owned_video_removes_row", async () => {
    const owner = await makeUser("owner");
    const video = await seedVideo(owner.id, "to-delete");
    const result = await deleteOwnedVideo(video.id, owner.id);
    expect(result.found).toBe(true);
    const fresh = await prisma.video.findUnique({ where: { id: video.id } });
    expect(fresh).toBeNull();
  });

  it("delete_owned_video_returns_not_found_for_non_owner", async () => {
    const owner = await makeUser("owner");
    const other = await makeUser("other");
    const video = await seedVideo(owner.id, "stay");
    const result = await deleteOwnedVideo(video.id, other.id);
    expect(result.found).toBe(false);
    const fresh = await prisma.video.findUnique({ where: { id: video.id } });
    expect(fresh).not.toBeNull();
  });

  it("reset_to_validating_flips_status_from_failed", async () => {
    const owner = await makeUser("owner");
    const video = await seedVideo(owner.id, "x", { status: "failed" });
    const result = await resetToValidating(video.id, owner.id);
    expect(result?.status).toBe("validating");
  });

  it("reset_to_validating_returns_null_when_status_is_not_failed", async () => {
    const owner = await makeUser("owner");
    const video = await seedVideo(owner.id, "x", { status: "ready" });
    const result = await resetToValidating(video.id, owner.id);
    expect(result).toBeNull();
  });
});

describe("libraryRepository - preferences", () => {
  it("update_library_preferences_persists_view", async () => {
    const user = await makeUser("p1");
    const updated = await updateLibraryPreferences(user.id, { view: "list" });
    expect(updated?.libraryView).toBe("list");
    expect(updated?.librarySort).toBe("recent");
  });

  it("update_library_preferences_persists_sort", async () => {
    const user = await makeUser("p2");
    const updated = await updateLibraryPreferences(user.id, {
      sort: "title_asc",
    });
    expect(updated?.libraryView).toBe("grid");
    expect(updated?.librarySort).toBe("title_asc");
  });

  it("read_library_preferences_returns_defaults_for_new_user", async () => {
    const user = await makeUser("p3");
    const prefs = await readLibraryPreferences(user.id);
    expect(prefs).toEqual({ libraryView: "grid", librarySort: "recent" });
  });

  it("update_library_preferences_rejects_unknown_value_at_db_level", async () => {
    const user = await makeUser("p4");
    await expect(
      prisma.$executeRaw(
        Prisma.sql`UPDATE "user" SET library_view = 'cards' WHERE id = ${user.id}`,
      ),
    ).rejects.toThrow();
  });
});
