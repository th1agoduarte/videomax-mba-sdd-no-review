type EmptyStateContext = "library" | "folder" | "unfiled";

const copy: Record<EmptyStateContext, string> = {
  library: "Upload your first video to get started",
  folder: "No videos in this folder yet",
  unfiled: "Everything is filed - drop a video here or pick a folder",
};

export function EmptyState({ context = "library" }: { context?: EmptyStateContext }) {
  return (
    <div
      data-testid="library-empty-state"
      className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-muted-surface px-6 py-12 text-center"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/empty-library.svg"
        alt=""
        width={220}
        height={160}
        className="h-32 w-auto"
      />
      <p className="text-base font-medium text-foreground">
        {copy[context]}
      </p>
    </div>
  );
}
