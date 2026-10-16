import Logo from './Logo.jsx';
import './AppHeader.css';

export default function AppHeader({ officer, onSignOut, onHome, wide = false }) {
  return (
    <header className={`app-header${wide ? ' is-compact' : ''}`}>
      <div className={`wrap app-header__inner${wide ? ' wrap--wide' : ''}`}>
        <button type="button" className="app-header__brand" onClick={onHome}>
          <Logo size={wide ? 44 : 56} />
          <span className="app-header__divider" aria-hidden="true" />
          <span className="app-header__app">Field Guard</span>
        </button>
        {officer && (
          <div className="app-header__user">
            <img className="app-header__avatar" src={officer.photo} alt="" />
            <div className="app-header__who">
              <div className="app-header__name">{officer.name}</div>
              <div className="app-header__role">{officer.role}</div>
            </div>
            <button type="button" className="btn ghost app-header__out" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
