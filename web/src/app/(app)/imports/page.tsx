import { ImportsContent } from "./ImportsContent";

export const dynamic = "force-dynamic";

export default function ImportsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium">Import statement</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Upload an Alinma XLSX or Al Rajhi PDF export to review and import transactions.
        </p>
      </div>

      <ImportsContent />
    </div>
  );
}
