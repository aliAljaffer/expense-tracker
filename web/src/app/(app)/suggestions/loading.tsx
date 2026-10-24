export default function SuggestionsLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <div className="h-9 w-32 animate-pulse rounded bg-[var(--color-surface-sunken)]" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-[var(--color-surface-sunken)]" />
      </div>

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
            <div className="space-y-4">
              <div>
                <div className="h-5 w-40 animate-pulse rounded bg-[var(--color-surface-sunken)]" />
                <div className="mt-2 h-4 w-full max-w-lg animate-pulse rounded bg-[var(--color-surface-sunken)]" />
              </div>

              <div className="h-3 w-32 animate-pulse rounded bg-[var(--color-surface-sunken)]" />

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[var(--color-border-default)]">
                      {Array.from({ length: 4 }).map((_, j) => (
                        <th key={j} className="px-3 py-2">
                          <div className="h-3 w-16 animate-pulse rounded bg-[var(--color-surface-sunken)]" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 2 }).map((_, row) => (
                      <tr key={row} className="border-b border-[var(--color-border-default)]">
                        {Array.from({ length: 4 }).map((_, col) => (
                          <td key={col} className="px-3 py-2">
                            <div className="h-3 w-20 animate-pulse rounded bg-[var(--color-surface-sunken)]" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 bg-[var(--color-surface-sunken)] p-3 rounded">
                <div className="h-3 w-24 animate-pulse rounded bg-[var(--color-border-default)]" />
                <div className="h-3 w-full animate-pulse rounded bg-[var(--color-border-default)]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
