const FILTERS = [
  { id: 'all', label: 'Alle' },
  { id: 'pending', label: 'Te beoordelen' },
  { id: 'approved', label: 'Goedgekeurd' },
  { id: 'rejected', label: 'Afgewezen' },
];

export default function SummaryBar({ counts, filter, onFilter, onExport, onReset }) {
  return (
    <div className="summary-bar">
      <div className="summary-counts">
        <span className="count count-total">{counts.total} totaal</span>
        <span className="count count-approved">{counts.approved} goedgekeurd</span>
        <span className="count count-rejected">{counts.rejected} afgewezen</span>
        <span className="count count-pending">{counts.pending} te beoordelen</span>
      </div>

      <div className="summary-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`filter-btn ${filter === f.id ? 'active' : ''}`}
            onClick={() => onFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="summary-actions">
        <button type="button" className="btn-export" onClick={onExport}>
          Exporteer CSV
        </button>
        <button type="button" className="btn-reset" onClick={onReset}>
          Reset
        </button>
      </div>
    </div>
  );
}
