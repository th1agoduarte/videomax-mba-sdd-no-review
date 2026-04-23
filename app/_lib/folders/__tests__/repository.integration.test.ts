import { afterAll, beforeEach, describe, expect, it } from "vitest";
import path from "node:path";
import { prisma } from "@/app/_lib/db";
import {
  assignVideoToFolder,
  createFolder,
  deleteFolder,
  listFoldersForUser,
  renameFolder,
} from "../repository";

async function makeUser(suffix: string) {
  return prisma.user.create({
    data: {
      email: `folder-repo-${suffix}@example.com`,
      name: `User ${suffix}`,
      passwordHash:
        "$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
}

async function seedVideo(userId: string, title: string, folderId?: string | null) {
  return prisma.video.create({
    data: {
      userId,
      title,
      originalFilename: `${title}.mp4`,
      sizeBytes: BigInt(1024),
      containerFormat: "mp4",
      storagePath: path.join(userId, "__seed__", "source.mp4"),
      status: "ready",
      folderId,
    },
  });
}

beforeEach(async () => {
  await prisma.video.deleteMany({});
  await prisma.folder.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("folder repository", () => {
  it("list_folders_returns_only_owner_rows_alphabetically_with_counts", async () => {
    const owner = await makeUser("owner");
    const other = await makeUser("other");
    const banana = await createFolder(owner.id, "Banana");
    const apple = await createFolder(owner.id, "apple");
    await createFolder(other.id, "Cherry");
    await seedVideo(owner.id, "filed", banana.id);
    const rows = await listFoldersForUser(owner.id);
    expect(rows.map((row) => row.name)).toEqual(["apple", "Banana"]);
    expect(rows.find((row) => row.id === banana.id)?.videoCount).toBe(1);
    expect(rows.find((row) => row.id === apple.id)?.videoCount).toBe(0);
  });

  it("create_folder_persists_trimmed_name_and_rejects_case_duplicate", async () => {
    const owner = await makeUser("create");
    const folder = await createFolder(owner.id, "  Courses  ");
    expect(folder.name).toBe("Courses");
    await expect(createFolder(owner.id, "courses")).rejects.toMatchObject({
      code: "FOLDER_NAME_DUPLICATE",
    });
  });

  it("rename_folder_rejects_duplicate_and_allows_same_value", async () => {
    const owner = await makeUser("rename");
    const a = await createFolder(owner.id, "Courses");
    const b = await createFolder(owner.id, "Meetings");
    await expect(renameFolder(owner.id, b.id, "courses")).rejects.toMatchObject({
      code: "FOLDER_NAME_DUPLICATE",
    });
    await expect(renameFolder(owner.id, a.id, "Courses")).resolves.toMatchObject({
      name: "Courses",
    });
  });

  it("delete_folder_sets_associated_videos_folder_id_to_null", async () => {
    const owner = await makeUser("delete");
    const folder = await createFolder(owner.id, "Courses");
    const video = await seedVideo(owner.id, "filed", folder.id);
    const deleted = await deleteFolder(owner.id, folder.id);
    expect(deleted?.id).toBe(folder.id);
    const fresh = await prisma.video.findUnique({ where: { id: video.id } });
    expect(fresh).not.toBeNull();
    expect(fresh?.folderId).toBeNull();
  });

  it("assign_video_to_folder_checks_video_and_folder_ownership", async () => {
    const owner = await makeUser("assign-owner");
    const other = await makeUser("assign-other");
    const folder = await createFolder(owner.id, "Courses");
    const otherFolder = await createFolder(other.id, "Other");
    const video = await seedVideo(owner.id, "mine");
    const otherVideo = await seedVideo(other.id, "theirs");

    await expect(assignVideoToFolder(owner.id, video.id, folder.id)).resolves.toEqual({
      videoId: video.id,
      folderId: folder.id,
    });
    await expect(assignVideoToFolder(owner.id, video.id, null)).resolves.toEqual({
      videoId: video.id,
      folderId: null,
    });
    await expect(assignVideoToFolder(owner.id, video.id, otherFolder.id)).resolves.toBeNull();
    await expect(assignVideoToFolder(owner.id, otherVideo.id, folder.id)).resolves.toBeNull();
  });
});
