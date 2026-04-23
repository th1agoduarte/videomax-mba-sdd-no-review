import { Prisma, type Folder, type PrismaClient } from "@prisma/client";
import { prisma } from "@/app/_lib/db";
import type { FolderErrorCode } from "./errors";
import { toFolderDTO, toFolderSidebarDTO, type FolderDTO, type FolderSidebarDTO } from "./dto";

type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

function isDuplicateNameError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function mapDuplicate(error: unknown): never {
  if (isDuplicateNameError(error)) {
    throw Object.assign(new Error("FOLDER_NAME_DUPLICATE"), {
      code: "FOLDER_NAME_DUPLICATE" satisfies FolderErrorCode,
    });
  }
  throw error;
}

function orderFolders<T extends { name: string }>(folders: T[]): T[] {
  return folders.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export async function listFoldersForUser(userId: string): Promise<FolderSidebarDTO[]> {
  const folders = await prisma.folder.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    include: { _count: { select: { videos: true } } },
  });

  return orderFolders(
    folders.map((folder) =>
      toFolderSidebarDTO({
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt,
        videoCount: folder._count.videos,
      }),
    ),
  );
}

export async function createFolder(
  userId: string,
  name: string,
  tx: Tx = prisma,
): Promise<FolderDTO> {
  try {
    const folder = await tx.folder.create({
      data: { userId, name: name.trim() },
    });
    return toFolderDTO(folder);
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function renameFolder(
  userId: string,
  folderId: string,
  name: string,
): Promise<FolderDTO | null> {
  const existing = await prisma.folder.findFirst({
    where: { id: folderId, userId },
    select: { id: true, name: true },
  });
  if (!existing) return null;
  if (existing.name === name.trim()) {
    const row = await prisma.folder.findUniqueOrThrow({ where: { id: folderId } });
    return toFolderDTO(row);
  }

  try {
    const folder = await prisma.folder.update({
      where: { id: folderId },
      data: { name: name.trim() },
    });
    return toFolderDTO(folder);
  } catch (error) {
    mapDuplicate(error);
  }
}

export async function deleteFolder(
  userId: string,
  folderId: string,
): Promise<Folder | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!existing) return null;
    await tx.folder.delete({ where: { id: folderId } });
    return existing;
  });
}

export async function assignVideoToFolder(
  userId: string,
  videoId: string,
  folderId: string | null,
  tx: Tx = prisma,
): Promise<{ videoId: string; folderId: string | null } | null> {
  const video = await tx.video.findFirst({
    where: { id: videoId, userId },
    select: { id: true },
  });
  if (!video) return null;

  if (folderId !== null) {
    const folder = await tx.folder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    });
    if (!folder) return null;
  }

  await tx.video.update({
    where: { id: videoId },
    data: { folderId },
  });
  return { videoId, folderId };
}

export async function videoExistsForUser(
  userId: string,
  videoId: string,
): Promise<boolean> {
  const row = await prisma.video.findFirst({
    where: { id: videoId, userId },
    select: { id: true },
  });
  return row !== null;
}

export async function folderExistsForUser(
  userId: string,
  folderId: string,
): Promise<boolean> {
  const row = await prisma.folder.findFirst({
    where: { id: folderId, userId },
    select: { id: true },
  });
  return row !== null;
}

export async function createFolderAndAssignVideo(
  userId: string,
  name: string,
  videoId: string,
): Promise<{ folder: FolderDTO; videoFolderId: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const folder = await createFolder(userId, name, tx);
      const assignment = await assignVideoToFolder(userId, videoId, folder.id, tx);
      if (!assignment) {
        throw Object.assign(new Error("FOLDER_VIDEO_NOT_FOUND"), {
          code: "FOLDER_VIDEO_NOT_FOUND" satisfies FolderErrorCode,
        });
      }
      return { folder, videoFolderId: folder.id };
    });
  } catch (error) {
    mapDuplicate(error);
  }
}

export function folderRepositoryErrorCode(error: unknown): FolderErrorCode | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    const code = error.code;
    if (code === "FOLDER_NAME_DUPLICATE" || code === "FOLDER_VIDEO_NOT_FOUND") {
      return code;
    }
  }
  return null;
}
