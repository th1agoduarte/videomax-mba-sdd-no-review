import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FolderCombobox } from "../FolderCombobox";
import { assignVideoToFolder, createFolder } from "@/app/_lib/folders/actions";

vi.mock("@/app/_lib/folders/actions", () => ({
  assignVideoToFolder: vi.fn(async () => ({ ok: true, folderId: "clvfolder1" })),
  createFolder: vi.fn(async () => ({
    ok: true,
    folder: { id: "clvnewfolder", name: "New" },
    videoFolderId: "clvnewfolder",
  })),
}));

const folders = [
  {
    id: "clvfolder1",
    name: "Courses",
    createdAt: new Date().toISOString(),
    videoCount: 1,
  },
];

describe("FolderCombobox", () => {
  it("selecting_existing_folder_assigns_video", async () => {
    const onAssigned = vi.fn();
    render(
      <FolderCombobox
        videoId="clvvideo00000000000000000"
        currentFolderId={null}
        folders={folders}
        onClose={vi.fn()}
        onAssigned={onAssigned}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Courses/i }));
    await waitFor(() => expect(assignVideoToFolder).toHaveBeenCalled());
    expect(onAssigned).toHaveBeenCalledWith("clvfolder1");
  });

  it("enter_on_no_match_creates_and_assigns", async () => {
    render(
      <FolderCombobox
        videoId="clvvideo00000000000000000"
        currentFolderId={null}
        folders={folders}
        onClose={vi.fn()}
        onAssigned={vi.fn()}
      />,
    );
    const input = screen.getByRole("textbox", { name: "Move to folder" });
    fireEvent.change(input, {
      target: { value: "Meetings" },
    });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(createFolder).toHaveBeenCalled());
  });
});
