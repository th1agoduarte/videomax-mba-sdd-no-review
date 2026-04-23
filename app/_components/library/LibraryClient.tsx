"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import type { FolderFilter, FolderSidebarDTO } from "@/app/_lib/folders/dto";
import type { VideoListItemDTO } from "@/app/_lib/videos/library";
import type {
  LibrarySort,
  LibraryView,
} from "@/app/_lib/videos/libraryValidation";
import { requestRetry } from "@/app/_lib/videos/actions";
import { ContextMenuItem } from "./ContextMenu";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { DescriptionModal } from "./DescriptionModal";
import { EmptyState } from "./EmptyState";
import { FolderCombobox } from "./FolderCombobox";
import { LibraryHeader } from "./LibraryHeader";
import { RenameField } from "./RenameField";
import { VideoCard } from "./VideoCard";
import { VideoGrid } from "./VideoGrid";
import { VideoList } from "./VideoList";
import { VideoRow } from "./VideoRow";

type Props = {
  initialItems: VideoListItemDTO[];
  initialView: LibraryView;
  initialSort: LibrarySort;
  folders?: FolderSidebarDTO[];
  folderFilter?: FolderFilter;
};

export function LibraryClient({
  initialItems,
  initialView,
  initialSort,
  folders = [],
  folderFilter = { kind: "all" },
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState<VideoListItemDTO[]>(initialItems);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [descriptionTarget, setDescriptionTarget] =
    useState<VideoListItemDTO | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<VideoListItemDTO | null>(null);
  const [moveTarget, setMoveTarget] = useState<VideoListItemDTO | null>(null);
  const [, startTransition] = useTransition();

  const updateItem = useCallback(
    (id: string, patch: Partial<VideoListItemDTO>) => {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const triggerRetry = useCallback(
    (item: VideoListItemDTO) => {
      const formData = new FormData();
      formData.set("id", item.id);
      updateItem(item.id, { status: "validating" });
      startTransition(async () => {
        const state = await requestRetry(undefined, formData);
        if (state.ok && state.item) {
          updateItem(item.id, state.item);
        } else {
          updateItem(item.id, { status: "failed" });
        }
        router.refresh();
      });
    },
    [updateItem, router],
  );

  function buildMenu(item: VideoListItemDTO): ContextMenuItem[] {
    const base: ContextMenuItem[] = [
      {
        key: "open",
        label: "Open",
        onSelect: () => {
          router.push(`/app/videos/${item.id}`);
        },
      },
      {
        key: "rename",
        label: "Rename",
        onSelect: () => setRenamingId(item.id),
      },
      {
        key: "description",
        label: "Edit description",
        onSelect: () => setDescriptionTarget(item),
      },
      {
        key: "move",
        label: "Move to folder",
        onSelect: () => setMoveTarget(item),
      },
      {
        key: "delete",
        label: "Delete",
        destructive: true,
        onSelect: () => setDeleteTarget(item),
      },
    ];
    if (item.status === "failed") {
      base.push({
        key: "retry",
        label: "Retry",
        onSelect: () => triggerRetry(item),
      });
    }
    return base;
  }

  const renderTitle = (item: VideoListItemDTO) => (
    <RenameField
      videoId={item.id}
      initialTitle={item.title}
      isEditing={renamingId === item.id}
      onClose={() => setRenamingId(null)}
      onRenamed={(title) => {
        updateItem(item.id, { title });
        router.refresh();
      }}
    />
  );

  return (
    <section
      data-testid="library-client"
      data-view={initialView}
      className="flex flex-col gap-4"
    >
      <LibraryHeader view={initialView} sort={initialSort} />
      {items.length === 0 ? (
        <EmptyState
          context={
            folderFilter.kind === "folder"
              ? "folder"
              : folderFilter.kind === "unfiled"
                ? "unfiled"
                : "library"
          }
        />
      ) : initialView === "grid" ? (
        <VideoGrid>
          {items.map((item) => (
            <VideoCard
              key={item.id}
              item={item}
              menuItems={buildMenu(item)}
              titleSlot={renderTitle(item)}
            />
          ))}
        </VideoGrid>
      ) : (
        <VideoList>
          {items.map((item) => (
            <VideoRow
              key={item.id}
              item={item}
              menuItems={buildMenu(item)}
              titleSlot={renderTitle(item)}
            />
          ))}
        </VideoList>
      )}
      {descriptionTarget && (
        <DescriptionModal
          open={true}
          videoId={descriptionTarget.id}
          videoTitle={descriptionTarget.title}
          initialDescription={descriptionTarget.description}
          onClose={() => setDescriptionTarget(null)}
          onSaved={(description) => {
            updateItem(descriptionTarget.id, { description });
            router.refresh();
          }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          open={true}
          videoId={deleteTarget.id}
          videoTitle={deleteTarget.title}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            removeItem(deleteTarget.id);
            router.refresh();
          }}
        />
      )}
      {moveTarget && (
        <FolderCombobox
          videoId={moveTarget.id}
          currentFolderId={moveTarget.folderId}
          folders={folders}
          onClose={() => setMoveTarget(null)}
          onAssigned={(folderId) => {
            updateItem(moveTarget.id, { folderId });
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
