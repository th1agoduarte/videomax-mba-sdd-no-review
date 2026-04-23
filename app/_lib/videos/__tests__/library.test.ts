import { describe, expect, it } from "vitest";
import { toVideoListItemDTO } from "../library";

describe("toVideoListItemDTO", () => {
  const baseRow = {
    id: "vid_1",
    title: "Hello",
    description: "",
    originalFilename: "hello.mp4",
    sizeBytes: BigInt(100),
    durationSeconds: null as unknown,
    containerFormat: "mp4",
    status: "ready",
    folderId: null,
    thumbnailPath: null,
    createdAt: new Date("2026-04-19T12:00:00.000Z"),
  };

  it("to_video_list_item_dto_serializes_bigint_and_decimal", () => {
    const dto = toVideoListItemDTO({
      ...baseRow,
      sizeBytes: BigInt("9000000000"),
      durationSeconds: { toString: () => "123.456" },
    });
    expect(dto.sizeBytes).toBe(9_000_000_000);
    expect(dto.durationSeconds).toBe(123.456);
  });

  it("to_video_list_item_dto_handles_number_size", () => {
    const dto = toVideoListItemDTO({ ...baseRow, sizeBytes: 1024 });
    expect(dto.sizeBytes).toBe(1024);
  });

  it("to_video_list_item_dto_sets_thumbnail_url", () => {
    const dto = toVideoListItemDTO(baseRow);
    expect(dto.thumbnailUrl).toBe(`/api/videos/${baseRow.id}/thumbnail`);
  });

  it("to_video_list_item_dto_flags_custom_thumbnail", () => {
    const placeholder = toVideoListItemDTO({ ...baseRow, thumbnailPath: null });
    const customised = toVideoListItemDTO({
      ...baseRow,
      thumbnailPath: "user1/vid_1/thumbnail.jpg",
    });
    expect(placeholder.hasCustomThumbnail).toBe(false);
    expect(customised.hasCustomThumbnail).toBe(true);
  });

  it("to_video_list_item_dto_serialises_createdAt_as_iso", () => {
    const dto = toVideoListItemDTO(baseRow);
    expect(dto.createdAt).toBe("2026-04-19T12:00:00.000Z");
  });

  it("to_video_list_item_dto_includes_folder_id", () => {
    const dto = toVideoListItemDTO({
      ...baseRow,
      folderId: "clvfolder0000000000000000",
    });
    expect(dto.folderId).toBe("clvfolder0000000000000000");
  });

  it("to_video_list_item_dto_folder_id_null_when_unfiled", () => {
    const dto = toVideoListItemDTO({ ...baseRow, folderId: null });
    expect(dto.folderId).toBeNull();
  });
});
