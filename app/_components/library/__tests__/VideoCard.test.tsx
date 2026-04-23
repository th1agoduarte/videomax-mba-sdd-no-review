import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoCard } from "../VideoCard";
import type { VideoListItemDTO } from "@/app/_lib/videos/library";

const baseItem: VideoListItemDTO = {
  id: "vid_1",
  title: "Morning standup",
  description: "",
  originalFilename: "standup.mp4",
  sizeBytes: 524_288_000,
  durationSeconds: 1823,
  containerFormat: "mp4",
  status: "ready",
  folderId: null,
  thumbnailUrl: "/api/videos/vid_1/thumbnail",
  hasCustomThumbnail: true,
  createdAt: "2026-04-15T12:00:00.000Z",
};

describe("VideoCard", () => {
  it("card_renders_thumbnail_title_duration_badge", () => {
    render(
      <VideoCard
        item={baseItem}
        menuItems={[{ key: "open", label: "Open", onSelect: () => {} }]}
      />,
    );
    expect(screen.getByText("Morning standup")).toBeInTheDocument();
    expect(screen.getByTestId("duration-overlay").textContent).toBe("30:23");
    expect(screen.getByRole("status")).toHaveAttribute("data-status", "ready");
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/app/videos/vid_1");
  });

  it("card_shows_status_badge_for_each_status", () => {
    const statuses = ["validating", "transcribing", "summarizing", "ready", "failed"];
    for (const status of statuses) {
      const { unmount, container } = render(
        <VideoCard
          item={{ ...baseItem, status }}
          menuItems={[{ key: "open", label: "Open", onSelect: () => {} }]}
        />,
      );
      expect(
        container.querySelector(`[data-status="${status}"]`),
      ).not.toBeNull();
      unmount();
    }
  });

  it("card_shows_duration_em_dash_when_null", () => {
    render(
      <VideoCard
        item={{ ...baseItem, durationSeconds: null }}
        menuItems={[{ key: "open", label: "Open", onSelect: () => {} }]}
      />,
    );
    expect(screen.getByTestId("duration-overlay").textContent).toBe("--:--");
  });
});
