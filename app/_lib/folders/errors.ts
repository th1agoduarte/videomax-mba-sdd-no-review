export const folderErrorCodes = [
  "FOLDER_FORBIDDEN",
  "FOLDER_NOT_FOUND",
  "FOLDER_NAME_EMPTY",
  "FOLDER_NAME_TOO_LONG",
  "FOLDER_NAME_DUPLICATE",
  "FOLDER_INVALID_INPUT",
  "FOLDER_VIDEO_NOT_FOUND",
] as const;

export type FolderErrorCode = (typeof folderErrorCodes)[number];

const messages: Record<FolderErrorCode, string> = {
  FOLDER_FORBIDDEN: "You must be signed in to manage folders",
  FOLDER_NOT_FOUND: "Folder not found",
  FOLDER_NAME_EMPTY: "Folder name cannot be empty",
  FOLDER_NAME_TOO_LONG: "Folder name must be at most 80 characters",
  FOLDER_NAME_DUPLICATE: "A folder with this name already exists",
  FOLDER_INVALID_INPUT: "Folder input is invalid",
  FOLDER_VIDEO_NOT_FOUND: "Video not found",
};

export function folderErrorMessage(code: FolderErrorCode): string {
  return messages[code];
}

export function isFolderErrorCode(value: string): value is FolderErrorCode {
  return (folderErrorCodes as readonly string[]).includes(value);
}
