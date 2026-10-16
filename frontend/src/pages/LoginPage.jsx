import { useState } from 'react';
import Logo from '../components/Logo.jsx';
import { OFFICER, signIn } from '../auth/officer.js';
import { greeting } from '../utils/greeting.js';
import './LoginPage.css';

export default function LoginPage({ onSignedIn }) {
  const [login, setLogin] = useState(OFFICER.id);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!login.trim() || !password) {
      setError('Please enter your officer ID and password.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const officer = await signIn(login, password);
      onSignedIn({ ...officer, remember });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <header className="login__header">
        <div className="wrap login__header-inner">
          <div className="login__brand">
            <Logo size={56} />
            <span className="login__divider" aria-hidden="true" />
            <span className="login__app">Field Guard</span>
          </div>
          <nav className="login__util">
            <a href="#help">Help</a>
            <span className="login__sep" aria-hidden="true" />
            <a href="#lang">English</a>
          </nav>
        </div>
      </header>

      <section className="login__band">
        <div className="wrap login__grid">
          <div className="login__intro">
            <div className="topline login__topline">Welthungerhilfe · Field advisory</div>
            <h1>
              {greeting()}, {OFFICER.name}.
            </h1>
            <p className="login__lead">
              Your {OFFICER.assignedFarmers} farmers are waiting for today's advice. Sign in to see visits, crop
              health alerts and harvest plans.
            </p>
          </div>

          <form className="login__card" onSubmit={handleSubmit} noValidate>
            <div className="login__profile">
              <img className="login__avatar" src={OFFICER.photo} alt={`Photo of ${OFFICER.name}`} />
              <div>
                <h2 className="login__name">{OFFICER.name}</h2>
                <div className="login__role">{OFFICER.role}</div>
                <div className="login__meta">
                  {OFFICER.region} · {OFFICER.assignedFarmers} farmers
                </div>
              </div>
            </div>

            <h3 className="login__title">Sign in</h3>

            <label className="field">
              <span className="field__label">Officer ID or email</span>
              <input
                className="field__input"
                type="text"
                autoComplete="username"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Password</span>
              <span className="field__row">
                <input
                  className="field__input"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'login-error' : undefined}
                  autoFocus
                />
                <button
                  type="button"
                  className="field__toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </span>
            </label>

            {error && (
              <p className="login__error" id="login-error" role="alert">
                {error}
              </p>
            )}

            <div className="login__options">
              <label className="check">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                <span className="check__box" aria-hidden="true" />
                Keep me signed in on this device
              </label>
              <button type="button" className="text-link">
                Forgot password?
              </button>
            </div>

            <button className="btn login__submit" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
              {!busy && <span className="arrow" aria-hidden="true" />}
            </button>

            <p className="login__switch">
              Not {OFFICER.name}?{' '}
              <button type="button" className="text-link">
                Use another account
              </button>
            </p>
            <p className="login__demo">Demo access: felix / demo</p>
          </form>
        </div>
      </section>

      <footer className="login__footer">
        <div className="wrap">
          <span>© Deutsche Welthungerhilfe e. V.</span>
          <a href="#privacy">Privacy</a>
          <a href="#imprint">Imprint</a>
          <a href="#support">Support</a>
        </div>
      </footer>
    </div>
  );
}
