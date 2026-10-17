import './WhiteflyBadge.css';

// Small amber flag for a farm whose sticky-trap whitefly count is rising.
export default function WhiteflyBadge() {
  return (
    <span className="whitefly-badge" title="Whitefly count on the sticky trap is rising — risk of cassava mosaic spread">
      Whiteflies ↑
    </span>
  );
}
