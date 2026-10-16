import { useEffect, useRef, useState } from 'react';

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Recording of the farmer call with a transcript that builds up live while it plays.
// With call.audio set, the real <audio> element drives the time; until the audio is
// uploaded, a placeholder clock plays the call at real speed so the flow can be shown.
export default function CallRecording({ call }) {
  const audioRef = useRef(null);
  const listRef = useRef(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const duration = call.duration ?? (call.lines.at(-1)?.t ?? 0) + 8;

  // placeholder clock — only without real audio
  useEffect(() => {
    if (call.audio || !playing) return undefined;
    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const step = (now - last) / 1000;
      last = now;
      setTime((t) => Math.min(duration, t + step));
    }, 100);
    return () => clearInterval(id);
  }, [playing, call.audio, duration]);

  // stop at the end of the placeholder recording
  useEffect(() => {
    if (!call.audio && playing && time >= duration) setPlaying(false);
  }, [time, playing, call.audio, duration]);

  // keep the newest line in view
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [time]);

  const toggle = () => {
    if (!playing && time >= duration) setTime(0);
    setStarted(true);
    if (call.audio) {
      const a = audioRef.current;
      if (a.paused) a.play();
      else a.pause();
      return;
    }
    setPlaying((p) => !p);
  };

  const seek = (t) => {
    setStarted(true);
    setTime(t);
    if (call.audio && audioRef.current) audioRef.current.currentTime = t;
  };

  // lines spoken so far; the current one is typed out in proportion to elapsed time
  const shown = call.lines
    .map((line, i) => {
      if (line.t > time) return null;
      const end = call.lines[i + 1]?.t ?? duration;
      const share = Math.min(1, (time - line.t) / Math.max(1, (end - line.t) * 0.8));
      const isCurrent = time < end;
      const text = isCurrent ? line.text.slice(0, Math.max(1, Math.round(line.text.length * share))) : line.text;
      return { ...line, text, isCurrent, i };
    })
    .filter(Boolean);

  return (
    <div className="call-rec">
      {call.audio ? (
        <audio
          ref={audioRef}
          src={call.audio}
          preload="metadata"
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
        />
      ) : null}

      <div className="call-rec__player">
        <button
          type="button"
          className={`call-rec__play${playing ? ' is-playing' : ''}`}
          onClick={toggle}
          aria-label={playing ? 'Pause recording' : 'Play recording'}
        >
          {playing ? (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2h3v12H4zM9 2h3v12H9z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2l10 6-10 6z" fill="currentColor" /></svg>
          )}
        </button>
        <input
          className="call-rec__bar"
          type="range"
          min="0"
          max={duration}
          step="0.1"
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Position in recording"
        />
        <span className="call-rec__time">
          {clock(time)} / {clock(duration)}
        </span>
        {!call.audio && <span className="placeholder-tag">Recording · placeholder</span>}
      </div>

      <div className="call-rec__live" ref={listRef} aria-live="polite">
        {!started ? (
          <p className="call-rec__hint">Press play — the transcript appears live as the call plays.</p>
        ) : (
          <ul className="transcript call-rec__lines">
            {shown.map((line) => (
              <li
                key={line.i}
                className={`transcript__line${line.who === 'Farmer' ? ' is-farmer' : ''}${line.isCurrent ? ' is-current' : ''}`}
                onClick={() => seek(line.t)}
                title="Jump to this moment"
              >
                <span className="transcript__who">{line.who}</span>
                <span className="transcript__text">
                  {line.text}
                  {line.isCurrent && playing && <span className="call-rec__caret" aria-hidden="true" />}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
