import { ImportsContent } from "./ImportsContent";

export const dynamic = "force-dynamic";

export default function ImportsPage() {
  return (
    <div className="shell page">
      <div className="page__intro">
        <h1 className="display">Import statement</h1>
        <p className="lede">
          Upload an Alinma XLSX or Al Rajhi PDF export to review and import transactions.
        </p>
      </div>

      <div className="section">
        <ImportsContent />
      </div>
    </div>
  );
}
