/** Approve / reject buttons plus a comment field, shared by ads and copy lines. */
export default function DecisionControls({ id, decision, placeholder, onSetStatus, onSetComment }) {
  const status = decision.status || 'pending';

  return (
    <>
      <div className="ad-card-actions">
        <button
          type="button"
          className={`btn-approve ${status === 'approved' ? 'active' : ''}`}
          onClick={() => onSetStatus(id, status === 'approved' ? 'pending' : 'approved')}
        >
          ✓ Goedkeuren
        </button>
        <button
          type="button"
          className={`btn-reject ${status === 'rejected' ? 'active' : ''}`}
          onClick={() => onSetStatus(id, status === 'rejected' ? 'pending' : 'rejected')}
        >
          ✕ Afwijzen
        </button>
      </div>

      <textarea
        className="ad-card-comment"
        placeholder={placeholder}
        value={decision.comment || ''}
        onChange={(e) => onSetComment(id, e.target.value)}
        rows={2}
      />
    </>
  );
}
