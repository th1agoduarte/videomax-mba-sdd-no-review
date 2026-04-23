"use client";

import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { createFolder, type FolderActionState } from "@/app/_lib/folders/actions";

const INITIAL_STATE: FolderActionState = { ok: false };

export function InlineCreateFolder() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createFolder, INITIAL_STATE);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (state.ok) {
      setName("");
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setName("");
      setClientError(null);
      setOpen(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 flex min-h-9 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-accent hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span aria-hidden="true">+</span>
        <span>New folder</span>
      </button>
    );
  }

  const serverError = state.fieldErrors?.name?.[0] ?? state.message;

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        const trimmed = name.trim();
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
      className="mt-2 flex flex-col gap-1"
    >
      <input
        ref={inputRef}
        type="text"
        name="name"
        value={name}
        maxLength={130}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Folder name"
        aria-invalid={Boolean(clientError ?? serverError)}
        className="h-9 rounded-md border border-border bg-white px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {(clientError ?? serverError) && (
        <p role="alert" className="text-xs text-red-700">
          {clientError ?? serverError}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Creating..." : "Create"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setName("");
            setClientError(null);
          }}
          className="rounded-md border border-border px-2 py-1 text-xs text-muted hover:bg-muted-surface"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
