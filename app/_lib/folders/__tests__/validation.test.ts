import { describe, expect, it } from "vitest";
import {
  assignVideoSchema,
  createFolderSchema,
  renameFolderSchema,
} from "../validation";

const CUID = "clv1234560000000000000000";

describe("folder validation", () => {
  it("create_rejects_empty_name_with_FOLDER_NAME_EMPTY", () => {
    const result = createFolderSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0].message).toBe(
      "FOLDER_NAME_EMPTY",
    );
  });

  it("create_trims_and_accepts_80_char_name", () => {
    const result = createFolderSchema.parse({ name: `  ${"a".repeat(80)}  ` });
    expect(result.name).toHaveLength(80);
  });

  it("create_rejects_81_char_name_with_FOLDER_NAME_TOO_LONG", () => {
    const result = createFolderSchema.safeParse({ name: "a".repeat(81) });
    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0].message).toBe(
      "FOLDER_NAME_TOO_LONG",
    );
  });

  it("rename_applies_same_bounds", () => {
    const result = renameFolderSchema.safeParse({ id: CUID, name: "   " });
    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0].message).toBe(
      "FOLDER_NAME_EMPTY",
    );
  });

  it("assign_accepts_null_folder_id_for_unfiled", () => {
    const result = assignVideoSchema.parse({ videoId: CUID, folderId: "" });
    expect(result.folderId).toBeNull();
  });

  it("assign_rejects_bad_video_id", () => {
    const result = assignVideoSchema.safeParse({ videoId: "", folderId: "" });
    expect(result.success).toBe(false);
  });
});
