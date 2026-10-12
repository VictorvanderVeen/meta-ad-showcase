import { campaignUrl } from '../lib/ads';

function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Archive picker: shown when a client link names no campaign. */
export default function CampaignList({ campaigns }) {
  return (
    <ul className="campaign-list">
      {campaigns.map((campaign) => (
        <li key={campaign.slug} className="campaign-list-item">
          <a href={campaignUrl(campaign.slug)} className="campaign-list-link">
            <span className="campaign-list-name">{campaign.name || campaign.slug}</span>
            {campaign.updatedAt && (
              <span className="campaign-list-date">bijgewerkt {formatDate(campaign.updatedAt)}</span>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}
