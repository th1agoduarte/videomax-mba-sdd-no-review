import { redirect } from "next/navigation";
import { LogoutButton } from "@/app/_components/LogoutButton";
import { FolderSidebar } from "@/app/_components/library/FolderSidebar";
import { LibraryClient } from "@/app/_components/library/LibraryClient";
import { UploadDropZone } from "@/app/_components/upload/UploadDropZone";
import { UploadProgressList } from "@/app/_components/upload/UploadProgressList";
import { resolveFolderFilter } from "@/app/_lib/folders/dto";
import { listFoldersForUser } from "@/app/_lib/folders/repository";
import { listVideosForUser } from "@/app/_lib/videos/library";
import {
  countForAllFilters,
  readLibraryPreferences,
} from "@/app/_lib/videos/libraryRepository";
import { getSession } from "@/app/_lib/session";

export const dynamic = "force-dynamic";

type AppHomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppHomePage({ searchParams }: AppHomePageProps = {}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const params = (await searchParams) ?? {};

  const prefs =
    (await readLibraryPreferences(session.user.id)) ?? {
      libraryView: "grid" as const,
      librarySort: "recent" as const,
    };

  const [folders, counts] = await Promise.all([
    listFoldersForUser(session.user.id),
    countForAllFilters(session.user.id),
  ]);
  const folderFilter = resolveFolderFilter(params.folder, folders);
  const items = await listVideosForUser(session.user.id, prefs.librarySort, {
    folderFilter,
  });

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-lg font-semibold text-foreground">Library</h1>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <FolderSidebar
            folders={folders}
            folderFilter={folderFilter}
            counts={counts}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <UploadDropZone />
            <UploadProgressList />
            <LibraryClient
              initialItems={items}
              initialView={prefs.libraryView}
              initialSort={prefs.librarySort}
              folders={folders}
              folderFilter={folderFilter}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
