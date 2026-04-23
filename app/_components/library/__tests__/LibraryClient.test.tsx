import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("@/app/_lib/videos/actions", () => ({
  renameVideo: vi.fn(),
  editVideoDescription: vi.fn(),
  deleteVideo: vi.fn(),
  requestRetry: vi.fn(),
  setLibraryPreferences: vi.fn(),
  submitLibraryPreferences: vi.fn(),
}));

vi.mock("@/app/_lib/folders/actions", () => ({
  assignVideoToFolder: vi.fn(async () => ({ ok: true, folderId: "clvfolder1" })),
  createFolder: vi.fn(async () => ({ ok: true, videoFolderId: "clvfolder1" })),
}));

import { fireEvent, render, screen } from "@testing-library/react";
import { LibraryClient } from "../LibraryClient";
import type { VideoListItemDTO } from "@/app/_lib/videos/library";

function makeItem(overrides: Partial<VideoListItemDTO> = {}): VideoListItemDTO {
  return {
    id: "vid_1",
    title: "Morning standup",
    description: "",
    originalFilename: "standup.mp4",
    sizeBytes: 1024,
    durationSeconds: 60,
    containerFormat: "mp4",
    status: "ready",
    folderId: null,
    thumbnailUrl: "/api/videos/vid_1/thumbnail",
    hasCustomThumbnail: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("LibraryClient", () => {
  it("renders_video_grid_when_view_is_grid", () => {
    render(
      <LibraryClient
        initialItems={[makeItem()]}
        initialView="grid"
        initialSort="recent"
      />,
    );
    expect(screen.getByTestId("video-grid")).toBeInTheDocument();
    expect(screen.queryByTestId("video-list")).toBeNull();
  });

  it("renders_video_list_when_view_is_list", () => {
    render(
      <LibraryClient
        initialItems={[makeItem()]}
        initialView="list"
        initialSort="recent"
      />,
    );
    expect(screen.getByTestId("video-list")).toBeInTheDocument();
    expect(screen.queryByTestId("video-grid")).toBeNull();
  });

  it("renders_empty_state_when_no_items", () => {
    render(
      <LibraryClient
        initialItems={[]}
        initialView="grid"
        initialSort="recent"
      />,
    );
    expect(screen.getByTestId("library-empty-state")).toBeInTheDocument();
  });

  it("opens_delete_modal_from_context_menu", () => {
    render(
      <LibraryClient
        initialItems={[makeItem()]}
        initialView="grid"
        initialSort="recent"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /actions for/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("opens_description_modal_from_context_menu", () => {
    render(
      <LibraryClient
        initialItems={[makeItem()]}
        initialView="grid"
        initialSort="recent"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /actions for/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit description" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("retry_only_visible_on_failed_videos", () => {
    const { unmount } = render(
      <LibraryClient
        initialItems={[makeItem({ status: "ready" })]}
        initialView="grid"
        initialSort="recent"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /actions for/i }));
    expect(screen.queryByRole("menuitem", { name: "Retry" })).toBeNull();
    unmount();
    render(
      <LibraryClient
        initialItems={[makeItem({ status: "failed" })]}
        initialView="grid"
        initialSort="recent"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /actions for/i }));
    expect(screen.getByRole("menuitem", { name: "Retry" })).toBeInTheDocument();
  });

  it("adds_move_to_folder_menu_item", () => {
    render(
      <LibraryClient
        initialItems={[makeItem()]}
        initialView="grid"
        initialSort="recent"
        folders={[
          {
            id: "clvfolder1",
            name: "Courses",
            createdAt: new Date().toISOString(),
            videoCount: 0,
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /actions for/i }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Move to folder" }));
    expect(screen.getByRole("dialog", { name: "Move to folder" })).toBeInTheDocument();
  });
});
