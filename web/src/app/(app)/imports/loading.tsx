export default function ImportsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <div className="h-9 w-40 animate-pulse rounded bg-[var(--color-surface-sunken)]" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-[var(--color-surface-sunken)]" />
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
          <div className="h-6 w-20 animate-pulse rounded bg-[var(--color-surface-sunken)] mb-4" />
          <div className="space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--color-surface-sunken)]" />
            <div className="h-10 w-24 animate-pulse rounded bg-[var(--color-surface-sunken)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
