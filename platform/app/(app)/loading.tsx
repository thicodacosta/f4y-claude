export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6" aria-live="polite" aria-busy="true">
      <div className="flex flex-col gap-2">
        <div className="h-7 w-48 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-muted/50" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/50" />
    </div>
  );
}
