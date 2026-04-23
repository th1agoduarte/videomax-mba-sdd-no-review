import { describe, expect, it } from "vitest";
import {
  parseFolderFilter,
  resolveFolderFilter,
  toFolderSidebarDTO,
} from "../dto";

const FOLDER_ID = "clv1234560000000000000000";

describe("folder DTO helpers", () => {
  it("parse_folder_filter_all_for_missing_param", () => {
    expect(parseFolderFilter(undefined)).toEqual({ kind: "all" });
  });

  it("parse_folder_filter_returns_unfiled", () => {
    expect(parseFolderFilter("unfiled")).toEqual({ kind: "unfiled" });
  });

  it("parse_folder_filter_returns_folder_with_cuid", () => {
    expect(parseFolderFilter(FOLDER_ID)).toEqual({
      kind: "folder",
      folderId: FOLDER_ID,
    });
  });

  it("parse_folder_filter_all_for_unknown_value", () => {
    expect(parseFolderFilter("xyz")).toEqual({ kind: "all" });
  });

  it("resolve_folder_filter_coerces_unknown_owned_folder_to_all", () => {
    expect(resolveFolderFilter(FOLDER_ID, [])).toEqual({ kind: "all" });
  });

  it("folder_sidebar_dto_includes_video_count", () => {
    expect(
      toFolderSidebarDTO({
        id: FOLDER_ID,
        name: "Courses",
        createdAt: new Date("2026-04-20T00:00:00.000Z"),
        videoCount: 3,
      }),
    ).toMatchObject({ id: FOLDER_ID, name: "Courses", videoCount: 3 });
  });
});
