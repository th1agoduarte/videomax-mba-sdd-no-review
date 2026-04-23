import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FolderDeleteConfirmModal } from "../FolderDeleteConfirmModal";
import { deleteFolder } from "@/app/_lib/folders/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/_lib/folders/actions", () => ({
  deleteFolder: vi.fn(async () => ({ ok: true })),
}));

describe("FolderDeleteConfirmModal", () => {
  it("renders_prd_copy_and_cancel_closes", () => {
    const onClose = vi.fn();
    render(
      <FolderDeleteConfirmModal
        open={true}
        folderId="clvfolder0000000000000000"
        folderName="Courses"
        activeFolderId=""
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Delete folder 'Courses'?")).toBeInTheDocument();
    expect(screen.getByText("Its videos will move to Unfiled.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("confirm_posts_delete_action", () => {
    render(
      <FolderDeleteConfirmModal
        open={true}
        folderId="clvfolder0000000000000000"
        folderName="Courses"
        activeFolderId=""
        onClose={vi.fn()}
      />,
    );
    fireEvent.submit(screen.getByRole("button", { name: "Delete" }).closest("form")!);
    expect(deleteFolder).toHaveBeenCalled();
  });
});
