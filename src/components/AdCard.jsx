import { adImageUrl } from '../lib/ads';
import DecisionControls from './DecisionControls';
import FeedAd from './FeedAd';

const STATUS_LABEL = {
  approved: 'Goedgekeurd',
  rejected: 'Afgewezen',
  pending: 'Nog te beoordelen',
};

export default function AdCard({ ad, copy, primaryText, headline, decision, onSetStatus, onSetComment }) {
  const status = decision.status || 'pending';

  return (
    <div className={`ad-card status-${status}`}>
      <div className="ad-card-media">
        {copy ? (
          <FeedAd
            imageUrl={adImageUrl(ad.file)}
            alt={ad.name}
            copy={copy}
            pageName={copy.pageName || ad.brand}
            primaryText={primaryText}
            headline={headline}
          />
        ) : (
          <img src={adImageUrl(ad.file)} alt={ad.name} loading="lazy" />
        )}
        <span className={`status-pill pill-${status}`}>{STATUS_LABEL[status]}</span>
      </div>

      <div className="ad-card-body">
        <h3 className="ad-card-name">{ad.name}</h3>
        <div className="ad-card-meta">
          {ad.brand && <span className="meta-tag">{ad.brand}</span>}
          {ad.format && <span className="meta-tag">{ad.format}</span>}
        </div>

        <DecisionControls
          id={ad.id}
          decision={decision}
          placeholder="Opmerking voor deze advertentie…"
          onSetStatus={onSetStatus}
          onSetComment={onSetComment}
        />
      </div>
    </div>
  );
}
