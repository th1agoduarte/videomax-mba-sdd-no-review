"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { renameFolder, type FolderActionState } from "@/app/_lib/folders/actions";

const INITIAL_STATE: FolderActionState = { ok: false };

type Props = {
  folderId: string;
  initialName: string;
  isEditing: boolean;
  onClose: () => void;
};

export function FolderRenameField({
  folderId,
  initialName,
  isEditing,
  onClose,
}: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(renameFolder, INITIAL_STATE);
  const [draft, setDraft] = useState(initialName);
  const [clientError, setClientError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) return undefined;
    setDraft(initialName);
    setClientError(null);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(id);
  }, [isEditing, initialName]);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onClose();
    }
  }, [state, router, onClose]);

  if (!isEditing) return <span className="truncate">{initialName}</span>;

  const serverError = state.fieldErrors?.name?.[0] ?? state.message;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const trimmed = draft.trim();
        if (trimmed.length === 0) {
          event.preventDefault();
          setClientError("Folder name cannot be empty");
          return;
        }
        if (trimmed.length > 80) {
          event.preventDefault();
          setClientError("Folder name must be at most 80 characters");
          return;
        }
        setClientError(null);
      }}
      className="flex flex-col gap-1 p-1"
    >
      <input type="hidden" name="id" value={folderId} />
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          type="text"
          name="name"
          value={draft}
          maxLength={130}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Folder name"
          aria-invalid={Boolean(clientError ?? serverError)}
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          Save
        </button>
      </div>
      {(clientError ?? serverError) && (
        <p role="alert" className="text-xs text-red-700">
          {clientError ?? serverError}
        </p>
      )}
    </form>
  );
}
