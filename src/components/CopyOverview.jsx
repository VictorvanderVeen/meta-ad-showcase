import DecisionControls from './DecisionControls';

/**
 * All Meta copy of the client in one list, each line with its own decision.
 * `groups` is [{ kind, title, items, selected, onSelect }]; a group with
 * `onSelect` can be previewed in the ads above.
 */
export default function CopyOverview({ groups, decisions, emptyDecision, onSetStatus, onSetComment }) {
  return (
    <section className="copy-overview">
      <h2>Alle advertentieteksten</h2>

      {groups.map((group) => (
        <div key={group.kind} className="copy-group">
          <h3>{group.title}</h3>
          {group.items.map((item, index) => {
            const decision = decisions[item.id] || emptyDecision;
            const shown = group.onSelect && index === group.selected;
            return (
              <div key={item.id} className={`copy-row status-${decision.status || 'pending'}`}>
                <div className="copy-row-text">
                  <span className="copy-row-number">{index + 1}</span>
                  <p>{item.name}</p>
                  {group.onSelect && (
                    <button
                      type="button"
                      className="copy-show-btn"
                      disabled={shown}
                      onClick={() => group.onSelect(index)}
                    >
                      {shown ? '✓ Staat in het voorbeeld' : 'Gebruik in het voorbeeld'}
                    </button>
                  )}
                </div>
                <div className="copy-row-controls">
                  <DecisionControls
                    id={item.id}
                    decision={decision}
                    placeholder="Opmerking bij deze tekst…"
                    onSetStatus={onSetStatus}
                    onSetComment={onSetComment}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
