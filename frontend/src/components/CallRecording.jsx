import { useEffect, useRef, useState } from 'react';

const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Audio player for one farmer call (no transcript on screen).
// With call.audio set, the real <audio> element drives the time; until the audio is
// uploaded, a placeholder clock plays the call at real speed so the flow can be shown.
export default function CallRecording({ call }) {
  const audioRef = useRef(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const duration = call.duration ?? (call.lines?.at(-1)?.t ?? 0) + 8;

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

  const toggle = () => {
    if (!playing && time >= duration) setTime(0);
    if (call.audio) {
      const a = audioRef.current;
      if (a.paused) a.play();
      else a.pause();
      return;
    }
    setPlaying((p) => !p);
  };

  const seek = (t) => {
    setTime(t);
    if (call.audio && audioRef.current) audioRef.current.currentTime = t;
  };

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
      </div>
    </div>
  );
}
