import { useEffect, useRef, useState } from 'react';

// The Azure setup deployed by azure/terraform/main.tf, drawn as a flow. Dots travel along
// the arrows when something really happens: a new reading from the box (with its values),
// every frontend poll, the LED colour the box fetches, and the 20-minute AI scoring run.

// node boxes: x, y, w, h (viewBox 820 × 640)
const NODES = {
  sensor: { x: 16, y: 92, w: 168, h: 96, title: 'Sensor box', sub: 'Arduino UNO R4 WiFi', outside: 'In the field' },
  browser: { x: 16, y: 452, w: 168, h: 96, title: 'Field Guard', sub: "Officer's browser", outside: 'Hoang' },
  func: { x: 262, y: 128, w: 252, h: 196, title: 'Function App', sub: 'azurerm_linux_function_app · Python' },
  storage: { x: 588, y: 64, w: 214, h: 196, title: 'Storage account', sub: 'azurerm_storage_account' },
  openai: { x: 588, y: 312, w: 214, h: 96, title: 'Azure OpenAI', sub: 'azurerm_cognitive_deployment' },
  swa: { x: 262, y: 452, w: 252, h: 96, title: 'Static Web App', sub: 'Standard · /api linked backend' },
  insights: { x: 588, y: 452, w: 214, h: 96, title: 'Application Insights', sub: '+ Log Analytics workspace' },
};

const FUNCTIONS = ['ingest', 'readings · farms · risk', 'light', 'score_timer'];
const TABLES = ['telemetry', 'fields', 'riskscores'];
const fnY = (i) => 196 + i * 30; // rows inside the Function App box
const tableY = (i) => 124 + i * 40; // rows inside the Storage box

const PATHS = {
  ingest: `M184 132 C 224 132, 222 ${fnY(0) + 10}, 262 ${fnY(0) + 10}`,
  write: `M514 ${fnY(0) + 10} C 552 ${fnY(0) + 10}, 552 ${tableY(0) + 14}, 600 ${tableY(0) + 14}`,
  read: `M600 ${tableY(0) + 22} C 552 ${tableY(0) + 22}, 552 ${fnY(1) + 10}, 514 ${fnY(1) + 10}`,
  toSwa: `M388 324 L388 452`,
  toBrowser: `M262 500 L184 500`,
  light: `M262 ${fnY(2) + 10} C 214 ${fnY(2) + 10}, 214 160, 184 160`,
  riskRead: `M600 ${tableY(2) + 14} C 552 ${tableY(2) + 14}, 552 ${fnY(3) + 6}, 514 ${fnY(3) + 6}`,
  toAi: `M514 ${fnY(3) + 12} C 548 ${fnY(3) + 12}, 556 350, 588 350`,
  fromAi: `M588 372 C 548 372, 548 ${tableY(2) + 22}, 600 ${tableY(2) + 22}`,
  logs: `M490 324 C 490 500, 540 500, 588 500`,
};

const fmt = (r) =>
  [r.temperature_c != null && `${r.temperature_c.toFixed(1)} °C`, r.humidity_pct != null && `${Math.round(r.humidity_pct)} %`]
    .filter(Boolean)
    .join(' · ');

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function nextScoring(now) {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setMinutes(Math.floor(now.getMinutes() / 20) * 20 + 20); // timer: 0 */20 * * * *
  return next;
}

export default function ArchitectureFlow({ controlRef, riskColor, deviceId, live }) {
  const pathEls = useRef({});
  const packets = useRef([]);
  const [, setFrame] = useState(0);
  const [glow, setGlow] = useState({});
  const [now, setNow] = useState(() => new Date());

  const flash = (key) => {
    setGlow((g) => ({ ...g, [key]: Date.now() }));
  };

  // a chain of legs: [{ path, ms, color, label, onArrive }]
  const send = (legs) => {
    if (reducedMotion()) {
      legs.forEach((l) => l.onArrive?.());
      return;
    }
    packets.current.push({ legs, leg: 0, start: performance.now() });
  };

  // what the modal can trigger
  useEffect(() => {
    controlRef.current = {
      reading: (r) => {
        send([
          { path: 'ingest', ms: 1300, color: '#2FAB16', label: fmt(r), onArrive: () => flash('ingest') },
          { path: 'write', ms: 800, color: '#2FAB16', label: fmt(r), onArrive: () => flash('telemetry') },
        ]);
        send([{ path: 'logs', ms: 1600, color: '#AAAAAC', onArrive: () => flash('insights') }]);
      },
      poll: () =>
        send([
          { path: 'read', ms: 700, color: '#404048', label: 'GET /api/readings', onArrive: () => flash('readings · farms · risk') },
          { path: 'toSwa', ms: 800, color: '#404048', onArrive: () => flash('swa') },
          { path: 'toBrowser', ms: 600, color: '#404048', onArrive: () => flash('browser') },
        ]),
    };
  });

  // LED colour: the box polls GET /api/light every 30 s
  useEffect(() => {
    const led = { red: '#CF0033', yellow: '#E08400', green: '#2FAB16' }[riskColor] ?? '#AAAAAC';
    const tick = () =>
      send([{ path: 'light', ms: 1200, color: led, label: `LED ${riskColor ?? 'off'}`, onArrive: () => flash('sensor') }]);
    const first = setTimeout(tick, 2500);
    const id = setInterval(tick, 30000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [riskColor]);

  // clock for the scoring countdown; animate the AI run when the timer fires
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setNow(d);
      if (d.getMinutes() % 20 === 0 && d.getSeconds() === 0) {
        send([
          { path: 'riskRead', ms: 900, color: '#B02885', label: 'score_timer', onArrive: () => flash('score_timer') },
          { path: 'toAi', ms: 900, color: '#B02885', onArrive: () => flash('openai') },
          { path: 'fromAi', ms: 1100, color: '#B02885', label: 'risk + steps', onArrive: () => flash('riskscores') },
        ]);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // animation loop
  useEffect(() => {
    let raf;
    const loop = (t) => {
      if (packets.current.length) {
        packets.current = packets.current.filter((p) => {
          const leg = p.legs[p.leg];
          if (t - p.start >= leg.ms) {
            leg.onArrive?.();
            p.leg += 1;
            p.start = t;
            return p.leg < p.legs.length;
          }
          return true;
        });
        setFrame((f) => f + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const isGlowing = (key) => glow[key] && Date.now() - glow[key] < 900;
  const minsToScoring = Math.max(0, Math.round((nextScoring(now) - now) / 60000));

  const dots = packets.current.map((p, i) => {
    const leg = p.legs[p.leg];
    const el = pathEls.current[leg.path];
    if (!el) return null;
    const share = Math.min(1, (performance.now() - p.start) / leg.ms);
    const eased = share < 0.5 ? 2 * share * share : 1 - (-2 * share + 2) ** 2 / 2;
    const pt = el.getPointAtLength(eased * el.getTotalLength());
    return (
      <g key={i} transform={`translate(${pt.x} ${pt.y})`}>
        <circle r="7" fill={leg.color} opacity="0.25" />
        <circle r="4.5" fill={leg.color} />
        {leg.label && (
          <text className="flow__packet" y="-11" textAnchor="middle">
            {leg.label}
          </text>
        )}
      </g>
    );
  });

  const Node = ({ id, children }) => {
    const n = NODES[id];
    return (
      <g className={`flow__node${isGlowing(id) ? ' is-glowing' : ''}`}>
        {n.outside && (
          <text className="flow__outside" x={n.x} y={n.y - 8}>
            {n.outside}
          </text>
        )}
        <rect x={n.x} y={n.y} width={n.w} height={n.h} />
        <text className="flow__title" x={n.x + 14} y={n.y + 26}>
          {n.title}
        </text>
        <text className="flow__sub" x={n.x + 14} y={n.y + 44}>
          {n.sub}
        </text>
        {children}
      </g>
    );
  };

  return (
    <svg className="flow" viewBox="0 0 820 640" role="img" aria-label="Azure architecture with live data flow">
      {/* resource group deployed by Terraform */}
      <rect className="flow__rg" x="236" y="22" width="580" height="604" />
      <text className="flow__rg-label" x="252" y="46">
        Azure resource group · deployed with Terraform (azure/terraform)
      </text>

      {Object.entries(PATHS).map(([key, d]) => (
        <path
          key={key}
          ref={(el) => {
            pathEls.current[key] = el;
          }}
          className={`flow__path is-${key}`}
          d={d}
        />
      ))}

      <Node id="sensor">
        <text className="flow__row" x={NODES.sensor.x + 14} y={NODES.sensor.y + 70}>
          {deviceId ?? 'demo box'} · every 5 s
        </text>
      </Node>
      <Node id="browser">
        <text className="flow__row" x={NODES.browser.x + 14} y={NODES.browser.y + 70}>
          polls every 5 s
        </text>
      </Node>

      <Node id="func">
        {FUNCTIONS.map((f, i) => (
          <g key={f} className={`flow__fn${isGlowing(f) ? ' is-glowing' : ''}`}>
            <rect x={NODES.func.x + 12} y={fnY(i) - 2} width={NODES.func.w - 24} height="24" />
            <text x={NODES.func.x + 22} y={fnY(i) + 14}>
              {f === 'score_timer' ? `score_timer · next run in ${minsToScoring} min` : f}
            </text>
          </g>
        ))}
      </Node>

      <Node id="storage">
        {TABLES.map((t, i) => (
          <g key={t} className={`flow__fn${isGlowing(t) ? ' is-glowing' : ''}`}>
            <rect x={NODES.storage.x + 12} y={tableY(i)} width={NODES.storage.w - 24} height="32" />
            <text x={NODES.storage.x + 22} y={tableY(i) + 21}>
              table · {t}
            </text>
          </g>
        ))}
      </Node>

      <Node id="openai">
        <text className="flow__row" x={NODES.openai.x + 14} y={NODES.openai.y + 70}>
          risk, reasoning, steps, call
        </text>
      </Node>
      <Node id="swa">
        <text className="flow__row" x={NODES.swa.x + 14} y={NODES.swa.y + 70}>
          serves this React app
        </text>
      </Node>
      <Node id="insights">
        <text className="flow__row" x={NODES.insights.x + 14} y={NODES.insights.y + 70}>
          logs every request
        </text>
      </Node>

      {/* arrow labels */}
      <text className="flow__edge" x="196" y="118">POST /api/ingest</text>
      <text className="flow__edge" x="190" y="196">GET /api/light</text>
      <text className="flow__edge" x="396" y="400">/api proxy</text>
      <text className="flow__edge" x="198" y="490">HTTPS</text>
      <text className={`flow__edge is-status${live ? ' is-live' : ''}`} x="252" y="616">
        {live ? '● Live data from the Function App' : '● Demo stream (no live sensor for this farm)'}
      </text>

      {dots}
    </svg>
  );
}
