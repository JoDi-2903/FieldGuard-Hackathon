// Thin green monoline icons without a circle — the way welthungerhilfe.de
// shows icons on white tiles ("Weitere Möglichkeiten zu helfen").
const PATHS = {
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>
  ),
  phone: <path d="M6.5 3.5h3l1.5 4-2 1.5a10 10 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2z" />,
  crop: (
    <>
      <path d="M12 21v-9" />
      <path d="M12 12c0-4 2.5-6.5 7-7 0 4.5-2.5 7-7 7z" />
      <path d="M12 15c0-3-2-5-6-5.5 0 3.5 2 5.5 6 5.5z" />
      <path d="M7 21h10" />
    </>
  ),
  humidity: (
    <>
      <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0c0-4.1 6-10.5 6-10.5z" />
      <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
    </>
  ),
  temperature: (
    <>
      <path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" />
      <path d="M12 9v7" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-13 14-13 0 9-5 13-12 13" />
      <path d="M5 19l7-7" />
      <path d="M17.5 15.5s1.5 1.8 1.5 2.8a1.5 1.5 0 0 1-3 0c0-1 1.5-2.8 1.5-2.8z" />
    </>
  ),
  soil: (
    <>
      <path d="M3.5 15h17M3.5 19h17" />
      <path d="M12 15V8" />
      <path d="M12 10c0-2.5 1.6-4 4.5-4.5 0 2.8-1.6 4.4-4.5 4.5zM12 11.5c0-2-1.3-3.3-3.8-3.6 0 2.3 1.4 3.5 3.8 3.6z" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4l9 15.5H3z" />
      <path d="M12 10v4.5M12 17v.01" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="1.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
      <path d="M9 15l2 2 4-4" />
    </>
  ),
};

export default function InfoIcon({ name }) {
  return (
    <span className="info-icon" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {PATHS[name]}
      </svg>
    </span>
  );
}
