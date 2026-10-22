import { useState } from 'react';
import { t } from '../lib/i18n';

/**
 * Approve / reject / comment buttons, shared by ads and copy lines. The
 * buttons are icons only, so they read the same in every language; the
 * translated word sits in the tooltip and aria-label. The comment field
 * opens with the pencil and stays open once it holds a comment.
 */
export default function DecisionControls({ id, decision, placeholder, onSetStatus, onSetComment }) {
  const status = decision.status || 'pending';
  const [commentOpen, setCommentOpen] = useState(false);
  const hasComment = Boolean(decision.comment);
  const showComment = commentOpen || hasComment;

  return (
    <>
      <div className="ad-card-actions">
        <button
          type="button"
          className={`btn-approve ${status === 'approved' ? 'active' : ''}`}
          title={t('approve')}
          aria-label={t('approve')}
          aria-pressed={status === 'approved'}
          onClick={() => onSetStatus(id, status === 'approved' ? 'pending' : 'approved')}
        >
          ✓
        </button>
        <button
          type="button"
          className={`btn-reject ${status === 'rejected' ? 'active' : ''}`}
          title={t('reject')}
          aria-label={t('reject')}
          aria-pressed={status === 'rejected'}
          onClick={() => onSetStatus(id, status === 'rejected' ? 'pending' : 'rejected')}
        >
          ✕
        </button>
        <button
          type="button"
          className={`btn-comment ${showComment ? 'active' : ''}`}
          title={t('comment')}
          aria-label={t('comment')}
          aria-expanded={showComment}
          disabled={hasComment}
          onClick={() => setCommentOpen((open) => !open)}
        >
          ✎
        </button>
      </div>

      {showComment && (
        <textarea
          className="ad-card-comment"
          placeholder={placeholder}
          value={decision.comment || ''}
          onChange={(e) => onSetComment(id, e.target.value)}
          rows={2}
          autoFocus={commentOpen && !hasComment}
        />
      )}
    </>
  );
}
