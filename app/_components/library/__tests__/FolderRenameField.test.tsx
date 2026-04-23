import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { FolderRenameField } from "../FolderRenameField";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/_lib/folders/actions", () => ({
  renameFolder: vi.fn(async () => ({ ok: true, folder: { name: "New" } })),
}));

describe("FolderRenameField", () => {
  it("field_enters_edit_mode_on_activation", () => {
    render(
      <FolderRenameField
        folderId="clvfolder0000000000000000"
        initialName="Courses"
        isEditing={true}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Folder name")).toHaveValue("Courses");
  });

  it("field_rejects_empty_submission_inline", () => {
    render(
      <FolderRenameField
        folderId="clvfolder0000000000000000"
        initialName="Courses"
        isEditing={true}
        onClose={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Folder name"), { target: { value: "" } });
    fireEvent.submit(screen.getByLabelText("Folder name").closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Folder name cannot be empty");
  });
});
