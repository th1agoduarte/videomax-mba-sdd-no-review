import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { InlineCreateFolder } from "../InlineCreateFolder";
import { createFolder } from "@/app/_lib/folders/actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/app/_lib/folders/actions", () => ({
  createFolder: vi.fn(async () => ({ ok: true })),
}));

describe("InlineCreateFolder", () => {
  it("clicking_plus_new_folder_opens_inline_input", () => {
    render(<InlineCreateFolder />);
    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    expect(screen.getByLabelText("Folder name")).toBeInTheDocument();
  });

  it("enter_submits_create_folder_action", () => {
    render(<InlineCreateFolder />);
    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    fireEvent.change(screen.getByLabelText("Folder name"), {
      target: { value: "Courses" },
    });
    fireEvent.submit(screen.getByLabelText("Folder name").closest("form")!);
    expect(createFolder).toHaveBeenCalled();
  });

  it("empty_name_error_shown_inline", () => {
    render(<InlineCreateFolder />);
    fireEvent.click(screen.getByRole("button", { name: /new folder/i }));
    fireEvent.submit(screen.getByLabelText("Folder name").closest("form")!);
    expect(screen.getByRole("alert")).toHaveTextContent("Folder name cannot be empty");
  });
});
