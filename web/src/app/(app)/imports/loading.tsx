export default function ImportsLoading() {
  return (
    <div className="shell page">
      <div className="page__intro">
        <div className="skeleton skeleton--title" />
        <div className="skeleton skeleton--line" />
      </div>

      <div className="section">
        <div className="card">
          <div className="skeleton skeleton--line" style={{ width: "var(--space-20)", marginBottom: "var(--space-4)" }} />
          <div className="stack--normal">
            <div className="skeleton skeleton--line" />
            <div className="skeleton" style={{ height: "var(--space-10)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
