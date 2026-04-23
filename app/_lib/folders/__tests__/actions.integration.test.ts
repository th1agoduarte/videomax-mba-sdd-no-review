import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/app/_lib/session", () => ({ getSession: vi.fn() }));

import path from "node:path";
import { prisma } from "@/app/_lib/db";
import { getSession } from "@/app/_lib/session";
import {
  assignVideoToFolder,
  createFolder,
  deleteFolder,
  renameFolder,
} from "../actions";

const sessionMock = vi.mocked(getSession);

function setSessionUser(userId: string) {
  sessionMock.mockResolvedValue({
    user: { id: userId, email: `${userId}@x.com`, name: "User", isAdmin: false },
  });
}

function asForm(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(data)) fd.set(k, v);
  return fd;
}

async function makeUser(suffix: string) {
  return prisma.user.create({
    data: {
      email: `folder-actions-${suffix}@example.com`,
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
  vi.restoreAllMocks();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("folder actions", () => {
  it("create_folder_happy_path_and_duplicate_error", async () => {
    const user = await makeUser("create");
    setSessionUser(user.id);
    const first = await createFolder(undefined, asForm({ name: "Courses" }));
    expect(first.ok).toBe(true);
    expect(first.folder?.name).toBe("Courses");
    const duplicate = await createFolder(undefined, asForm({ name: "courses" }));
    expect(duplicate.code).toBe("FOLDER_NAME_DUPLICATE");
  });

  it("create_folder_with_assign_video_id_moves_video_in_same_tx", async () => {
    const user = await makeUser("assign-create");
    setSessionUser(user.id);
    const video = await seedVideo(user.id, "video");
    const result = await createFolder(
      undefined,
      asForm({ name: "Courses", assignVideoId: video.id }),
    );
    expect(result.ok).toBe(true);
    expect(result.videoFolderId).toBe(result.folder?.id);
    const fresh = await prisma.video.findUnique({ where: { id: video.id } });
    expect(fresh?.folderId).toBe(result.folder?.id);
  });

  it("create_folder_no_session_returns_FOLDER_FORBIDDEN", async () => {
    sessionMock.mockResolvedValue(null);
    const result = await createFolder(undefined, asForm({ name: "Courses" }));
    expect(result.code).toBe("FOLDER_FORBIDDEN");
  });

  it("rename_folder_happy_path_and_non_owner_error", async () => {
    const owner = await makeUser("rename-owner");
    const other = await makeUser("rename-other");
    setSessionUser(owner.id);
    const folder = await createFolder(undefined, asForm({ name: "Old" }));
    const renamed = await renameFolder(
      undefined,
      asForm({ id: folder.folder?.id ?? "", name: "New" }),
    );
    expect(renamed.folder?.name).toBe("New");
    setSessionUser(other.id);
    const blocked = await renameFolder(
      undefined,
      asForm({ id: folder.folder?.id ?? "", name: "Nope" }),
    );
    expect(blocked.code).toBe("FOLDER_NOT_FOUND");
  });

  it("delete_folder_unfiles_videos_and_returns_redirect_for_active_filter", async () => {
    const user = await makeUser("delete");
    setSessionUser(user.id);
    const folder = await createFolder(undefined, asForm({ name: "Courses" }));
    const folderId = folder.folder?.id ?? "";
    const video = await seedVideo(user.id, "filed", folderId);
    const result = await deleteFolder(
      undefined,
      asForm({ id: folderId, activeFolderId: folderId }),
    );
    expect(result.ok).toBe(true);
    expect(result.redirectTo).toBe("/app?folder=all");
    const fresh = await prisma.video.findUnique({ where: { id: video.id } });
    expect(fresh?.folderId).toBeNull();
  });

  it("assign_video_to_folder_handles_folder_and_video_errors", async () => {
    const owner = await makeUser("assign-owner");
    const other = await makeUser("assign-other");
    setSessionUser(owner.id);
    const folder = await createFolder(undefined, asForm({ name: "Courses" }));
    const video = await seedVideo(owner.id, "mine");
    const moved = await assignVideoToFolder(
      undefined,
      asForm({ videoId: video.id, folderId: folder.folder?.id ?? "" }),
    );
    expect(moved.folderId).toBe(folder.folder?.id);
    const unfiled = await assignVideoToFolder(
      undefined,
      asForm({ videoId: video.id, folderId: "" }),
    );
    expect(unfiled.folderId).toBeNull();
    const otherVideo = await seedVideo(other.id, "theirs");
    const missingVideo = await assignVideoToFolder(
      undefined,
      asForm({ videoId: otherVideo.id, folderId: folder.folder?.id ?? "" }),
    );
    expect(missingVideo.code).toBe("FOLDER_VIDEO_NOT_FOUND");
  });
});
