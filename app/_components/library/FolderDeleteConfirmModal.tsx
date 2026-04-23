"use client";

import { useActionState, useEffect, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { deleteFolder, type FolderActionState } from "@/app/_lib/folders/actions";

const INITIAL_STATE: FolderActionState = { ok: false };

type Props = {
  open: boolean;
  folderId: string;
  folderName: string;
  activeFolderId: string;
  onClose: () => void;
};

export function FolderDeleteConfirmModal({
  open,
  folderId,
  folderName,
  activeFolderId,
  onClose,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteFolder, INITIAL_STATE);

  useEffect(() => {
    if (!state.ok) return;
    onClose();
    if (state.redirectTo) {
      router.replace(state.redirectTo);
    } else {
      router.refresh();
    }
  }, [state, router, onClose]);

  if (!open) return null;

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={`Delete folder ${folderName}`}
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="mb-2 text-base font-semibold text-foreground">
          {`Delete folder '${folderName}'?`}
        </h2>
        <p className="mb-4 text-sm text-muted">Its videos will move to Unfiled.</p>
        {state.message && !state.ok && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {state.message}
          </p>
        )}
        <form action={formAction} className="flex justify-end gap-2">
          <input type="hidden" name="id" value={folderId} />
          <input type="hidden" name="activeFolderId" value={activeFolderId} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:bg-muted-surface"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Deleting..." : "Delete"}
          </button>
        </form>
      </div>
    </div>
  );
}
