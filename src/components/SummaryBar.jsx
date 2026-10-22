import { t } from '../lib/i18n';

const FILTERS = [
  { id: 'all', label: 'filterAll' },
  { id: 'pending', label: 'filterPending' },
  { id: 'approved', label: 'approved' },
  { id: 'rejected', label: 'rejected' },
];

const SYNC_LABEL = { saving: 'saving', saved: 'saved', offline: 'offline' };

export default function SummaryBar({ counts, filter, onFilter, syncStatus, onExport, onReset }) {
  return (
    <div className="summary-bar">
      <div className="summary-counts">
        <span className="count count-total">{counts.total} {t('countTotal')}</span>
        <span className="count count-approved">{counts.approved} {t('countApproved')}</span>
        <span className="count count-rejected">{counts.rejected} {t('countRejected')}</span>
        <span className="count count-pending">{counts.pending} {t('countPending')}</span>
      </div>

      <div className="summary-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`filter-btn ${filter === f.id ? 'active' : ''}`}
            onClick={() => onFilter(f.id)}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      <div className="summary-actions">
        {SYNC_LABEL[syncStatus] && (
          <span className={`sync-status sync-${syncStatus}`} role="status">
            {t(SYNC_LABEL[syncStatus])}
          </span>
        )}
        <button type="button" className="btn-export" onClick={onExport}>
          {t('exportCsv')}
        </button>
        <button type="button" className="btn-reset" onClick={onReset}>
          {t('reset')}
        </button>
      </div>
    </div>
  );
}
