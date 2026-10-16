import logoSrc from '../assets/whh-logo.png';
import './Logo.css';

// Official Welthungerhilfe logo (mark + wordmark). `size` is the rendered height in px.
export default function Logo({ size = 56 }) {
  return <img className="logo" src={logoSrc} alt="Welthungerhilfe" style={{ height: size }} />;
}
