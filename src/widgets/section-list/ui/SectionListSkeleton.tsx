export function SectionListSkeleton() {
  return (
    <div className="sections-wrap">
      {[120, 180, 140, 160, 110].map((w, i) => (
        <div key={i} className="section">
          <div className="section-header" style={{ cursor: 'default' }}>
            <div className="skeleton" style={{ width: w, height: 13 }} />
            <div className="skeleton" style={{ width: 52, height: 2, marginLeft: 'auto' }} />
            <div className="skeleton" style={{ width: 28, height: 11, borderRadius: 2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
