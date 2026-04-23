"use server";

import { revalidatePath } from "next/cache";
import type { ZodSchema } from "zod";
import { getSession } from "@/app/_lib/session";
import {
  assignVideoToFolder as assignVideoToFolderRepo,
  createFolder as createFolderRepo,
  createFolderAndAssignVideo,
  deleteFolder as deleteFolderRepo,
  folderExistsForUser,
  folderRepositoryErrorCode,
  renameFolder as renameFolderRepo,
  videoExistsForUser,
} from "./repository";
import {
  assignVideoSchema,
  createFolderSchema,
  deleteFolderSchema,
  renameFolderSchema,
} from "./validation";
import {
  type FolderErrorCode,
  folderErrorMessage,
  isFolderErrorCode,
} from "./errors";
import type { FolderDTO } from "./dto";

type FieldErrors = Record<string, string[]>;

export type FolderActionState = {
  ok: boolean;
  code?: FolderErrorCode;
  message?: string;
  fieldErrors?: FieldErrors;
  folder?: FolderDTO;
  deletedId?: string;
  redirectTo?: string;
  videoId?: string;
  folderId?: string | null;
  videoFolderId?: string;
};

const FORBIDDEN: FolderActionState = {
  ok: false,
  code: "FOLDER_FORBIDDEN",
  message: folderErrorMessage("FOLDER_FORBIDDEN"),
};

function failure(code: FolderErrorCode): FolderActionState {
  return { ok: false, code, message: folderErrorMessage(code) };
}

function fieldErrorsFromZod<T>(
  schema: ZodSchema<T>,
  input: unknown,
):
  | { ok: true; data: T }
  | { ok: false; code: FolderErrorCode; fieldErrors: FieldErrors } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };

  const fieldErrors: FieldErrors = {};
  let primaryCode: FolderErrorCode = "FOLDER_INVALID_INPUT";
  for (const issue of parsed.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    const code = isFolderErrorCode(issue.message)
      ? issue.message
      : "FOLDER_INVALID_INPUT";
    primaryCode = code;
    if (!fieldErrors[key]) fieldErrors[key] = [];
    fieldErrors[key].push(folderErrorMessage(code));
  }
  return { ok: false, code: primaryCode, fieldErrors };
}

function validationFailure(result: {
  code: FolderErrorCode;
  fieldErrors: FieldErrors;
}): FolderActionState {
  return {
    ok: false,
    code: result.code,
    message: folderErrorMessage(result.code),
    fieldErrors: result.fieldErrors,
  };
}

function repoFailure(error: unknown): FolderActionState | null {
  const code = folderRepositoryErrorCode(error);
  return code ? failure(code) : null;
}

export async function createFolder(
  _prev: FolderActionState | undefined,
  formData: FormData,
): Promise<FolderActionState> {
  const session = await getSession();
  if (!session) return FORBIDDEN;

  const parsed = fieldErrorsFromZod(createFolderSchema, {
    name: formData.get("name"),
    assignVideoId: formData.get("assignVideoId") ?? undefined,
  });
  if (!parsed.ok) return validationFailure(parsed);

  try {
    const assignVideoId =
      parsed.data.assignVideoId && parsed.data.assignVideoId !== ""
        ? parsed.data.assignVideoId
        : null;
    if (assignVideoId) {
      const result = await createFolderAndAssignVideo(
        session.user.id,
        parsed.data.name,
        assignVideoId,
      );
      revalidatePath("/app");
      return {
        ok: true,
        folder: result.folder,
        videoFolderId: result.videoFolderId,
      };
    }

    const folder = await createFolderRepo(session.user.id, parsed.data.name);
    revalidatePath("/app");
    return { ok: true, folder };
  } catch (error) {
    const mapped = repoFailure(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function renameFolder(
  _prev: FolderActionState | undefined,
  formData: FormData,
): Promise<FolderActionState> {
  const session = await getSession();
  if (!session) return FORBIDDEN;

  const parsed = fieldErrorsFromZod(renameFolderSchema, {
    id: formData.get("id"),
    name: formData.get("name"),
  });
  if (!parsed.ok) return validationFailure(parsed);

  try {
    const folder = await renameFolderRepo(
      session.user.id,
      parsed.data.id,
      parsed.data.name,
    );
    if (!folder) return failure("FOLDER_NOT_FOUND");
    revalidatePath("/app");
    return { ok: true, folder };
  } catch (error) {
    const mapped = repoFailure(error);
    if (mapped) return mapped;
    throw error;
  }
}

export async function deleteFolder(
  _prev: FolderActionState | undefined,
  formData: FormData,
): Promise<FolderActionState> {
  const session = await getSession();
  if (!session) return FORBIDDEN;

  const parsed = fieldErrorsFromZod(deleteFolderSchema, {
    id: formData.get("id"),
    activeFolderId: formData.get("activeFolderId") ?? undefined,
  });
  if (!parsed.ok) return validationFailure(parsed);

  const deleted = await deleteFolderRepo(session.user.id, parsed.data.id);
  if (!deleted) return failure("FOLDER_NOT_FOUND");
  revalidatePath("/app");
  return {
    ok: true,
    deletedId: parsed.data.id,
    redirectTo:
      parsed.data.activeFolderId === parsed.data.id ? "/app?folder=all" : undefined,
  };
}

export async function assignVideoToFolder(
  _prev: FolderActionState | undefined,
  formData: FormData,
): Promise<FolderActionState> {
  const session = await getSession();
  if (!session) return FORBIDDEN;

  const parsed = fieldErrorsFromZod(assignVideoSchema, {
    videoId: formData.get("videoId"),
    folderId: formData.get("folderId") ?? undefined,
  });
  if (!parsed.ok) return validationFailure(parsed);
  const targetFolderId = parsed.data.folderId ?? null;

  const assignment = await assignVideoToFolderRepo(
    session.user.id,
    parsed.data.videoId,
    targetFolderId,
  );
  if (!assignment) {
    const hasVideo = await videoExistsForUser(session.user.id, parsed.data.videoId);
    if (!hasVideo) return failure("FOLDER_VIDEO_NOT_FOUND");
    if (
      targetFolderId !== null &&
      !(await folderExistsForUser(session.user.id, targetFolderId))
    ) {
      return failure("FOLDER_NOT_FOUND");
    }
    return failure("FOLDER_INVALID_INPUT");
  }

  revalidatePath("/app");
  return {
    ok: true,
    videoId: assignment.videoId,
    folderId: assignment.folderId,
  };
}
