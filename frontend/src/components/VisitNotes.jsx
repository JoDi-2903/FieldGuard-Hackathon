import { useEffect, useRef, useState } from 'react';
import { clock, mmss } from '../utils/time.js';

// Chat-style field notes: type a note or record a voice note while walking the field.
export default function VisitNotes({ notes, onAdd }) {
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef(null);
  const timerRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [notes.length]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  function sendText(e) {
    e.preventDefault();
    if (!text.trim()) return;
    onAdd({ id: crypto.randomUUID(), kind: 'text', text: text.trim(), at: new Date() });
    setText('');
  }

  async function startRecording() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      const startedAt = Date.now();
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        onAdd({
          id: crypto.randomUUID(),
          kind: 'audio',
          url: URL.createObjectURL(blob),
          seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
          at: new Date(),
        });
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError('Microphone access was blocked. Allow it in the browser to record voice notes.');
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  return (
    <div className="notes">
      <div className="notes__list" ref={listRef}>
        {notes.length === 0 && (
          <p className="notes__empty">
            Walk the field and record what you see — tap the microphone for a voice note, or type.
          </p>
        )}
        {notes.map((n) => (
          <div key={n.id} className="note">
            {n.kind === 'text' ? (
              <p className="note__text">{n.text}</p>
            ) : (
              <>
                <div className="note__audio-head">Voice note · {mmss(n.seconds)}</div>
                <audio className="note__audio" controls src={n.url} />
                <div className="note__pending">Transcript will appear here (placeholder)</div>
              </>
            )}
            <span className="note__time">{clock(n.at)}</span>
          </div>
        ))}
      </div>

      {error && (
        <p className="notes__error" role="alert">
          {error}
        </p>
      )}

      <form className="notes__composer" onSubmit={sendText}>
        {recording ? (
          <div className="notes__rec" aria-live="polite">
            <span className="notes__rec-dot" aria-hidden="true" />
            Recording {mmss(seconds)}
          </div>
        ) : (
          <input
            className="notes__input"
            type="text"
            placeholder="Type a note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        )}
        <button
          type="button"
          className={`notes__mic${recording ? ' is-recording' : ''}`}
          onClick={recording ? stopRecording : startRecording}
          aria-label={recording ? 'Stop recording' : 'Record voice note'}
        >
          {recording ? (
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="3" y="3" width="10" height="10" fill="currentColor" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="7" y="2" width="6" height="11" rx="3" />
              <path d="M4 10a6 6 0 0 0 12 0M10 16v2" />
            </svg>
          )}
        </button>
        {!recording && (
          <button type="submit" className="btn notes__send" disabled={!text.trim()}>
            Send
          </button>
        )}
      </form>
    </div>
  );
}
