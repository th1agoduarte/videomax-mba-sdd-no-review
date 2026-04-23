export type FolderDTO = {
  id: string;
  name: string;
  createdAt: string;
};

export type FolderSidebarDTO = FolderDTO & {
  videoCount: number;
};

export type FolderFilter =
  | { kind: "all" }
  | { kind: "unfiled" }
  | { kind: "folder"; folderId: string };

const CUID_RE = /^c[a-z0-9]{8,}$/i;

export function toFolderDTO(row: {
  id: string;
  name: string;
  createdAt: Date;
}): FolderDTO {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toFolderSidebarDTO(row: {
  id: string;
  name: string;
  createdAt: Date;
  videoCount: number;
}): FolderSidebarDTO {
  return {
    ...toFolderDTO(row),
    videoCount: row.videoCount,
  };
}

export function parseFolderFilter(raw: string | string[] | undefined): FolderFilter {
  if (typeof raw !== "string") return { kind: "all" };
  if (raw === "all") return { kind: "all" };
  if (raw === "unfiled") return { kind: "unfiled" };
  if (CUID_RE.test(raw)) return { kind: "folder", folderId: raw };
  return { kind: "all" };
}

export function resolveFolderFilter(
  raw: string | string[] | undefined,
  folders: ReadonlyArray<{ id: string }>,
): FolderFilter {
  const parsed = parseFolderFilter(raw);
  if (parsed.kind !== "folder") return parsed;
  return folders.some((folder) => folder.id === parsed.folderId)
    ? parsed
    : { kind: "all" };
}

export function folderFilterParam(filter: FolderFilter): string {
  if (filter.kind === "folder") return filter.folderId;
  return filter.kind;
}
