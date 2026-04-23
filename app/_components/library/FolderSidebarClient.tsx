"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FolderFilter, FolderSidebarDTO } from "@/app/_lib/folders/dto";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { FolderDeleteConfirmModal } from "./FolderDeleteConfirmModal";
import { FolderRenameField } from "./FolderRenameField";
import { InlineCreateFolder } from "./InlineCreateFolder";

type Props = {
  folders: FolderSidebarDTO[];
  folderFilter: FolderFilter;
  counts: {
    all: number;
    unfiled: number;
    perFolder: Record<string, number>;
  };
};

function isActive(filter: FolderFilter, value: "all" | "unfiled" | string) {
  if (value === "all" || value === "unfiled") return filter.kind === value;
  return filter.kind === "folder" && filter.folderId === value;
}

function NavLink({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-9 items-center justify-between gap-2 rounded-md px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active
          ? "bg-accent/10 font-medium text-accent"
          : "text-muted hover:bg-muted-surface hover:text-foreground"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="rounded-full bg-muted-surface px-2 py-0.5 text-xs text-muted">
        {count}
      </span>
    </Link>
  );
}

export function FolderSidebarClient({ folders, folderFilter, counts }: Props) {
  const [open, setOpen] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FolderSidebarDTO | null>(null);
  const activeFolderId = folderFilter.kind === "folder" ? folderFilter.folderId : "";

  useEffect(() => {
    if (typeof window.localStorage.getItem !== "function") return;
    const stored = window.localStorage.getItem("videomax:foldersSidebarOpen");
    if (stored === "0") setOpen(false);
  }, []);

  function persistOpen(next: boolean) {
    setOpen(next);
    if (typeof window.localStorage.setItem === "function") {
      window.localStorage.setItem("videomax:foldersSidebarOpen", next ? "1" : "0");
    }
  }

  function folderMenu(folder: FolderSidebarDTO): ContextMenuItem[] {
    return [
      {
        key: "rename",
        label: "Rename",
        onSelect: () => setRenamingId(folder.id),
      },
      {
        key: "delete",
        label: "Delete",
        destructive: true,
        onSelect: () => setDeleteTarget(folder),
      },
    ];
  }

  return (
    <div className="rounded-lg border border-border bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Folders</h2>
        <button
          type="button"
          aria-label={open ? "Collapse folder sidebar" : "Expand folder sidebar"}
          onClick={() => persistOpen(!open)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted hover:bg-muted-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span aria-hidden="true">{open ? "-" : "+"}</span>
        </button>
      </div>
      {open && (
        <div className="mt-3 flex flex-col gap-1">
          <NavLink
            href="/app?folder=all"
            active={isActive(folderFilter, "all")}
            label="All videos"
            count={counts.all}
          />
          <NavLink
            href="/app?folder=unfiled"
            active={isActive(folderFilter, "unfiled")}
            label="Unfiled"
            count={counts.unfiled}
          />
          <div className="my-2 h-px bg-border" />
          {folders.map((folder) => {
            const active = isActive(folderFilter, folder.id);
            return (
              <div
                key={folder.id}
                className={`group flex min-h-9 items-center gap-1 rounded-md ${
                  active ? "bg-accent/10" : "hover:bg-muted-surface"
                }`}
              >
                <div className="min-w-0 flex-1">
                  {renamingId === folder.id ? (
                    <FolderRenameField
                      folderId={folder.id}
                      initialName={folder.name}
                      isEditing={true}
                      onClose={() => setRenamingId(null)}
                    />
                  ) : (
                    <NavLink
                      href={`/app?folder=${folder.id}`}
                      active={active}
                      label={folder.name}
                      count={counts.perFolder[folder.id] ?? folder.videoCount}
                    />
                  )}
                </div>
                {renamingId !== folder.id && (
                  <ContextMenu
                    items={folderMenu(folder)}
                    triggerLabel={`Folder actions for ${folder.name}`}
                  />
                )}
              </div>
            );
          })}
          <InlineCreateFolder />
        </div>
      )}
      {deleteTarget && (
        <FolderDeleteConfirmModal
          open={true}
          folderId={deleteTarget.id}
          folderName={deleteTarget.name}
          activeFolderId={activeFolderId}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
