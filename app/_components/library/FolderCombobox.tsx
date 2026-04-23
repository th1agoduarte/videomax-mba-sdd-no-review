"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
} from "react";
import {
  assignVideoToFolder,
  createFolder,
} from "@/app/_lib/folders/actions";
import type { FolderSidebarDTO } from "@/app/_lib/folders/dto";

type Props = {
  videoId: string;
  currentFolderId: string | null;
  folders: FolderSidebarDTO[];
  onClose: () => void;
  onAssigned: (folderId: string | null) => void;
};

type Option = {
  key: string;
  label: string;
  folderId: string | null;
  create?: boolean;
};

export function FolderCombobox({
  videoId,
  currentFolderId,
  folders,
  onClose,
  onAssigned,
}: Props) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, []);

  const options = useMemo<Option[]>(() => {
    const normalized = query.trim().toLowerCase();
    const folderOptions = folders
      .filter((folder) => folder.name.toLowerCase().includes(normalized))
      .map((folder) => ({
        key: folder.id,
        label: folder.name,
        folderId: folder.id,
      }));
    const base: Option[] = [
      { key: "unfiled", label: "Unfiled", folderId: null },
      ...folderOptions,
    ];
    if (
      normalized.length > 0 &&
      !folders.some((folder) => folder.name.toLowerCase() === normalized)
    ) {
      base.push({
        key: "create",
        label: `Create new folder '${query.trim()}'`,
        folderId: null,
        create: true,
      });
    }
    return base;
  }, [folders, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function selectOption(option: Option) {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      if (option.create) {
        formData.set("name", query.trim());
        formData.set("assignVideoId", videoId);
        const state = await createFolder(undefined, formData);
        if (state.ok && state.videoFolderId) {
          onAssigned(state.videoFolderId);
          onClose();
        } else {
          setError(state.message ?? "Folder could not be created");
        }
        return;
      }

      formData.set("videoId", videoId);
      formData.set("folderId", option.folderId ?? "");
      onAssigned(option.folderId);
      const state = await assignVideoToFolder(undefined, formData);
      if (state.ok) {
        onAssigned(state.folderId ?? null);
        onClose();
      } else {
        onAssigned(currentFolderId);
        setError(state.message ?? "Video could not be moved");
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + options.length) % options.length);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectOption(options[activeIndex]);
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Move to folder"
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/20 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-white p-3 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Move to folder"
          aria-label="Move to folder"
          className="h-9 w-full rounded-md border border-border px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <ul role="listbox" className="mt-2 max-h-64 overflow-auto py-1">
          {options.map((option, index) => (
            <li key={option.key} role="option" aria-selected={index === activeIndex}>
              <button
                type="button"
                disabled={pending}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  index === activeIndex ? "bg-muted-surface text-foreground" : "text-muted"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {!option.create && option.folderId === currentFolderId && (
                  <span className="text-xs text-accent">Current</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
