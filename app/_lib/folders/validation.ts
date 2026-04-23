import { z } from "zod";

const cuid = z.string().cuid("FOLDER_INVALID_INPUT");
const folderName = z
  .string()
  .transform((value) => value.trim())
  .pipe(
    z
      .string()
      .min(1, "FOLDER_NAME_EMPTY")
      .max(80, "FOLDER_NAME_TOO_LONG"),
  );

const optionalFolderId = z
  .union([cuid, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : null));

export const createFolderSchema = z.object({
  name: folderName,
  assignVideoId: z.union([cuid, z.literal(""), z.null(), z.undefined()]).optional(),
});

export const renameFolderSchema = z.object({
  id: cuid,
  name: folderName,
});

export const deleteFolderSchema = z.object({
  id: cuid,
  activeFolderId: z.union([cuid, z.literal(""), z.null(), z.undefined()]).optional(),
});

export const assignVideoSchema = z.object({
  videoId: cuid,
  folderId: optionalFolderId,
});

export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type RenameFolderInput = z.infer<typeof renameFolderSchema>;
export type DeleteFolderInput = z.infer<typeof deleteFolderSchema>;
export type AssignVideoInput = z.infer<typeof assignVideoSchema>;
