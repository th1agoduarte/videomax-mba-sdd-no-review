import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoRow } from "../VideoRow";
import type { VideoListItemDTO } from "@/app/_lib/videos/library";

const baseItem: VideoListItemDTO = {
  id: "vid_1",
  title: "Morning standup",
  description: "",
  originalFilename: "standup.mp4",
  sizeBytes: 1_048_576,
  durationSeconds: 65,
  containerFormat: "mp4",
  status: "ready",
  folderId: null,
  thumbnailUrl: "/api/videos/vid_1/thumbnail",
  hasCustomThumbnail: true,
  createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
};

describe("VideoRow", () => {
  it("row_renders_all_columns", () => {
    render(
      <ul>
        <VideoRow
          item={baseItem}
          menuItems={[{ key: "open", label: "Open", onSelect: () => {} }]}
        />
      </ul>,
    );
    expect(screen.getByText("Morning standup")).toBeInTheDocument();
    expect(screen.getByTestId("row-duration").textContent).toBe("01:05");
    expect(screen.getByTestId("row-size").textContent).toBe("1.00 MB");
    expect(screen.getByTestId("row-upload-date").textContent).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("row_status_badge_matches_status", () => {
    const { container } = render(
      <ul>
        <VideoRow
          item={{ ...baseItem, status: "failed" }}
          menuItems={[{ key: "open", label: "Open", onSelect: () => {} }]}
        />
      </ul>,
    );
    expect(container.querySelector('[data-status="failed"]')).not.toBeNull();
  });

  it("row_shows_context_menu_trigger", () => {
    render(
      <ul>
        <VideoRow
          item={baseItem}
          menuItems={[{ key: "open", label: "Open", onSelect: () => {} }]}
        />
      </ul>,
    );
    expect(
      screen.getByRole("button", { name: /actions for/i }),
    ).toBeInTheDocument();
  });
});
