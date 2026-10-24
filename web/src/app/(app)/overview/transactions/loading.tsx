export default function TransactionsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <div className="h-9 w-40 animate-pulse rounded bg-[var(--color-surface-sunken)]" />
        <div className="h-4 w-full max-w-md animate-pulse rounded bg-[var(--color-surface-sunken)]" />
      </div>

      <div className="space-y-4">
        <div className="h-4 w-80 animate-pulse rounded bg-[var(--color-surface-sunken)]" />

        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="px-4 py-3 text-left"><div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></th>
                  <th className="px-4 py-3 text-left"><div className="h-4 w-24 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></th>
                  <th className="px-4 py-3 text-left"><div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></th>
                  <th className="px-4 py-3 text-right"><div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></th>
                  <th className="px-4 py-3 text-right"><div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></th>
                  <th className="px-4 py-3 text-right"><div className="h-4 w-16 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-[var(--color-border-default)]">
                    <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-4 w-20 animate-pulse rounded bg-[var(--color-surface-sunken)]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
