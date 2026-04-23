import type { FolderFilter, FolderSidebarDTO } from "@/app/_lib/folders/dto";
import { FolderSidebarClient } from "./FolderSidebarClient";

type Props = {
  folders: FolderSidebarDTO[];
  folderFilter: FolderFilter;
  counts: {
    all: number;
    unfiled: number;
    perFolder: Record<string, number>;
  };
};

export function FolderSidebar({ folders, folderFilter, counts }: Props) {
  return (
    <aside
      data-testid="folder-sidebar"
      className="w-full shrink-0 lg:sticky lg:top-6 lg:w-64"
    >
      <FolderSidebarClient
        folders={folders}
        folderFilter={folderFilter}
        counts={counts}
      />
    </aside>
  );
}
