import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FolderSidebar } from "../FolderSidebar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/_lib/folders/actions", () => ({
  createFolder: vi.fn(),
  renameFolder: vi.fn(),
  deleteFolder: vi.fn(),
}));

const folders = [
  {
    id: "clvbanana000000000000000",
    name: "Banana",
    createdAt: new Date().toISOString(),
    videoCount: 2,
  },
  {
    id: "clvapple0000000000000000",
    name: "apple",
    createdAt: new Date().toISOString(),
    videoCount: 1,
  },
];

describe("FolderSidebar", () => {
  it("sidebar_renders_all_videos_unfiled_and_folders_with_counts", () => {
    render(
      <FolderSidebar
        folders={folders}
        folderFilter={{ kind: "folder", folderId: folders[1].id }}
        counts={{ all: 4, unfiled: 1, perFolder: { [folders[0].id]: 2, [folders[1].id]: 1 } }}
      />,
    );
    expect(screen.getByRole("link", { name: /All videos4/i })).toHaveAttribute(
      "href",
      "/app?folder=all",
    );
    expect(screen.getByRole("link", { name: /Unfiled1/i })).toHaveAttribute(
      "href",
      "/app?folder=unfiled",
    );
    const active = screen.getByRole("link", { name: /apple1/i });
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("href", `/app?folder=${folders[1].id}`);
  });
});
