import { clock } from '../utils/time.js';

const OUTCOMES = [
  { id: 'ok', label: 'All good', text: 'No action needed' },
  { id: 'monitor', label: 'Monitor', text: 'Re-check at next visit' },
  { id: 'treat', label: 'Treatment', text: 'Farmer acts on advice' },
  { id: 'escalate', label: 'Escalate', text: 'Send to crop specialist / lab' },
];

export default function VisitVerdict({ verdict, onChange, onSave }) {
  const set = (patch) => onChange({ ...verdict, ...patch, savedAt: null });
  const canSave = Boolean(verdict.outcome);

  return (
    <form
      className="verdict"
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) onSave();
      }}
    >
      <fieldset className="verdict__outcomes">
        <legend className="visually-hidden">Outcome</legend>
        {OUTCOMES.map((o) => (
          <label key={o.id} className={`outcome${verdict.outcome === o.id ? ' is-on' : ''}`} title={o.text}>
            <input type="radio" name="outcome" value={o.id} checked={verdict.outcome === o.id} onChange={() => set({ outcome: o.id })} />
            {o.label}
          </label>
        ))}
      </fieldset>

      <textarea
        className="field__input verdict__text"
        aria-label="Diagnosis and advice given"
        placeholder="Diagnosis and advice given to the farmer…"
        value={verdict.diagnosis ?? ''}
        onChange={(e) => set({ diagnosis: e.target.value })}
      />

      <div className="verdict__actions">
        <label className="verdict__date">
          <span>Follow-up</span>
          <input className="field__input" type="date" value={verdict.followUp ?? ''} onChange={(e) => set({ followUp: e.target.value })} />
        </label>
        <button className="btn" type="submit" disabled={!canSave}>
          Save report
        </button>
      </div>
      <span className="verdict__status">
        {verdict.savedAt ? `Saved at ${clock(verdict.savedAt)}` : canSave ? 'Not saved yet' : 'Choose an outcome to save'}
      </span>
    </form>
  );
}
