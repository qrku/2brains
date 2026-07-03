export function ProgressSummarySkeleton() {
  return (
    <>
      <div className="summary">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="metric">
            <div className="skeleton" style={{ width: 52, height: 10, marginBottom: 10 }} />
            <div className="skeleton" style={{ width: 44, height: 24 }} />
          </div>
        ))}
      </div>
      <div className="progress-wrap">
        <div className="progress-label">
          <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 2 }} />
          <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 2 }} />
        </div>
        <div className="progress-track" />
      </div>
    </>
  );
}
