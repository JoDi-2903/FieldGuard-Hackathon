import { useRef } from 'react';

// Take or upload field photos (on phones `capture` opens the camera).
export default function VisitPhotos({ photos, onAdd, onRemove }) {
  const inputRef = useRef(null);

  function handleFiles(e) {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith('image/'));
    files.forEach((file) =>
      onAdd({ id: crypto.randomUUID(), url: URL.createObjectURL(file), name: file.name, at: new Date() })
    );
    e.target.value = '';
  }

  return (
    <div className="photos">
      <div className="photos__grid">
        {photos.map((p) => (
          <figure key={p.id} className="photo">
            <img src={p.url} alt={p.name} />
            <button type="button" className="photo__remove" onClick={() => onRemove(p.id)} aria-label={`Remove ${p.name}`}>
              ×
            </button>
          </figure>
        ))}
        <button type="button" className="photos__add" onClick={() => inputRef.current?.click()}>
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M4 10h5l2-3h8l2 3h5v14H4z" />
            <circle cx="15" cy="16" r="4.5" />
          </svg>
          <span>Take or add photo</span>
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={handleFiles} />
      <p className="photos__hint">
        {photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} · ` : ''}
        Close-ups of affected leaves and one photo of the whole field help the diagnosis.
      </p>
    </div>
  );
}
