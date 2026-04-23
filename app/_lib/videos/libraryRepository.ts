import type { Prisma, Video } from "@prisma/client";
import { prisma } from "@/app/_lib/db";
import type { FolderFilter } from "@/app/_lib/folders/dto";
import {
  type LibrarySort,
  type LibraryView,
  isLibrarySort,
  isLibraryView,
} from "./libraryValidation";

function orderByForSort(sort: LibrarySort): Prisma.VideoOrderByWithRelationInput[] {
  switch (sort) {
    case "recent":
      return [{ createdAt: "desc" }, { id: "desc" }];
    case "oldest":
      return [{ createdAt: "asc" }, { id: "asc" }];
    case "title_asc":
      return [{ title: "asc" }, { id: "asc" }];
  }
}

export type LibraryListFilters = {
  folderFilter?: FolderFilter;
  tagFilter?: Prisma.VideoWhereInput;
};

function whereForFilters(
  userId: string,
  filters: LibraryListFilters = {},
): Prisma.VideoWhereInput {
  const where: Prisma.VideoWhereInput = { userId };
  const folderFilter = filters.folderFilter;
  if (folderFilter?.kind === "unfiled") {
    where.folderId = null;
  }
  if (folderFilter?.kind === "folder") {
    where.folderId = folderFilter.folderId;
  }
  if (filters.tagFilter) {
    where.AND = [filters.tagFilter];
  }
  return where;
}

export async function listByUser(
  userId: string,
  sort: LibrarySort,
  filters: LibraryListFilters = {},
): Promise<Video[]> {
  return prisma.video.findMany({
    where: whereForFilters(userId, filters),
    orderBy: orderByForSort(sort),
  });
}

export async function countForAllFilters(userId: string): Promise<{
  all: number;
  unfiled: number;
  perFolder: Record<string, number>;
}> {
  const grouped = await prisma.video.groupBy({
    by: ["folderId"],
    where: { userId },
    _count: { _all: true },
  });

  const perFolder: Record<string, number> = {};
  let all = 0;
  let unfiled = 0;
  for (const row of grouped) {
    all += row._count._all;
    if (row.folderId === null) {
      unfiled = row._count._all;
    } else {
      perFolder[row.folderId] = row._count._all;
    }
  }
  return { all, unfiled, perFolder };
}

export async function updateTitle(
  id: string,
  userId: string,
  title: string,
): Promise<Video | null> {
  const result = await prisma.video.updateMany({
    where: { id, userId },
    data: { title },
  });
  if (result.count === 0) return null;
  return prisma.video.findUnique({ where: { id } });
}

export async function updateDescription(
  id: string,
  userId: string,
  description: string,
): Promise<Video | null> {
  const result = await prisma.video.updateMany({
    where: { id, userId },
    data: { description },
  });
  if (result.count === 0) return null;
  return prisma.video.findUnique({ where: { id } });
}

export async function deleteOwnedVideo(
  id: string,
  userId: string,
): Promise<{ found: boolean }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.video.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!existing) return { found: false };
    await tx.video.delete({ where: { id } });
    return { found: true };
  });
}

export async function resetToValidating(
  id: string,
  userId: string,
): Promise<Video | null> {
  const result = await prisma.video.updateMany({
    where: { id, userId, status: "failed" },
    data: { status: "validating" },
  });
  if (result.count === 0) return null;
  return prisma.video.findUnique({ where: { id } });
}

export type LibraryPreferences = {
  view?: LibraryView;
  sort?: LibrarySort;
};

export async function updateLibraryPreferences(
  userId: string,
  preferences: LibraryPreferences,
): Promise<{ libraryView: LibraryView; librarySort: LibrarySort } | null> {
  const data: { libraryView?: LibraryView; librarySort?: LibrarySort } = {};
  if (preferences.view !== undefined) data.libraryView = preferences.view;
  if (preferences.sort !== undefined) data.librarySort = preferences.sort;
  if (Object.keys(data).length === 0) return null;
  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { libraryView: true, librarySort: true },
  });
  return {
    libraryView: isLibraryView(updated.libraryView) ? updated.libraryView : "grid",
    librarySort: isLibrarySort(updated.librarySort) ? updated.librarySort : "recent",
  };
}

export async function readLibraryPreferences(
  userId: string,
): Promise<{ libraryView: LibraryView; librarySort: LibrarySort } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { libraryView: true, librarySort: true },
  });
  if (!user) return null;
  return {
    libraryView: isLibraryView(user.libraryView) ? user.libraryView : "grid",
    librarySort: isLibrarySort(user.librarySort) ? user.librarySort : "recent",
  };
}
