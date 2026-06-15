import { adImageUrl } from '../lib/ads';

const STATUS_LABEL = {
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  pending: 'Nog te beoordelen',
};

export default function AdCard({ ad, decision, onSetStatus, onSetComment }) {
  const status = decision.status || 'pending';

  return (
    <div className={`ad-card status-${status}`}>
      <div className="ad-card-media">
        <img src={adImageUrl(ad.file)} alt={ad.name} loading="lazy" />
        <span className={`status-pill pill-${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="ad-card-body">
        <h3 className="ad-card-name">{ad.name}</h3>
        <div className="ad-card-meta">
          {ad.brand && <span className="meta-tag">{ad.brand}</span>}
          {ad.format && <span className="meta-tag">{ad.format}</span>}
        </div>

        <div className="ad-card-actions">
          <button
            type="button"
            className={`btn-approve ${status === 'approved' ? 'active' : ''}`}
            onClick={() => onSetStatus(ad.id, status === 'approved' ? 'pending' : 'approved')}
          >
            ✓ Goedkeuren
          </button>
          <button
            type="button"
            className={`btn-reject ${status === 'rejected' ? 'active' : ''}`}
            onClick={() => onSetStatus(ad.id, status === 'rejected' ? 'pending' : 'rejected')}
          >
            ✕ Afwijzen
          </button>
        </div>

        <textarea
          className="ad-card-comment"
          placeholder="Opmerking voor deze advertentie…"
          value={decision.comment || ''}
          onChange={(e) => onSetComment(ad.id, e.target.value)}
          rows={2}
        />
      </div>
    </div>
  );
}
