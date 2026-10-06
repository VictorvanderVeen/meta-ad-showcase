import { useState } from 'react';

// Facebook cuts a long primary text off and shows "Meer weergeven".
const COLLAPSE_AT = 160;

function collapse(text) {
  if (text.length <= COLLAPSE_AT) return null;
  const cut = text.slice(0, COLLAPSE_AT);
  return cut.slice(0, cut.lastIndexOf(' ')).trimEnd();
}

function PrimaryText({ text }) {
  const [open, setOpen] = useState(false);
  const short = collapse(text);

  if (!short || open) return <p className="feed-primary-text">{text}</p>;
  return (
    <p className="feed-primary-text">
      {short}…{' '}
      <button type="button" className="feed-more" onClick={() => setOpen(true)}>
        Meer weergeven
      </button>
    </p>
  );
}

/**
 * One ad image dressed up as a Facebook feed ad, so the client sees it the
 * way it will run. `copy` is the client's Meta copy (see lib/ads.js);
 * `primaryText` and `headline` are the variants currently picked as example.
 */
export default function FeedAd({ imageUrl, alt, copy, pageName, primaryText, headline }) {
  const description = copy.descriptions?.[0];

  return (
    <div className="feed-ad">
      <div className="feed-header">
        <div className="feed-avatar" style={{ background: copy.color || '#65676b' }}>
          {(pageName || '?').trim().charAt(0).toUpperCase()}
        </div>
        <div className="feed-header-text">
          <span className="feed-page-name">{pageName}</span>
          <span className="feed-sponsored">Gesponsord</span>
        </div>
        <span className="feed-header-dots" aria-hidden="true">•••</span>
      </div>

      {/* key: a newly picked variant starts collapsed again */}
      {primaryText && <PrimaryText key={primaryText} text={primaryText} />}

      <img className="feed-image" src={imageUrl} alt={alt} loading="lazy" />

      <div className="feed-link-row">
        <div className="feed-link-text">
          {copy.domain && <span className="feed-link-domain">{copy.domain}</span>}
          {headline && <span className="feed-link-headline">{headline}</span>}
          {description && <span className="feed-link-description">{description}</span>}
        </div>
        {copy.cta && <span className="feed-cta-btn">{copy.cta}</span>}
      </div>

      <div className="feed-actions" aria-hidden="true">
        <span>Vind ik leuk</span>
        <span>Reageren</span>
        <span>Delen</span>
      </div>
    </div>
  );
}
