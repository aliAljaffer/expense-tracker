export default function HealthLoading() {
  return (
    <div className="loading" aria-busy="true" aria-live="polite">
      <span className="loading__label">Loading the readiness checks.</span>
      <div className="skeleton skeleton--title" />
      <div className="skeleton skeleton--line" />
      <div className="skeleton skeleton--panel" />
    </div>
  );
}
