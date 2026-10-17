// The four live metrics in the sensor view. Thresholds mirror azure/functionapp/views.py
// so the charts and the backend's tile status always agree.
// domain = physical range; each chart zooms to its data and thresholds ± pad inside it.
export const METRICS = [
  {
    key: 'humidity_pct',
    label: 'Humidity',
    unit: '%',
    decimals: 0,
    status: (v) => (v >= 90 ? 'alert' : v >= 80 ? 'warn' : 'ok'),
    note: (v) => (v >= 90 ? 'Above 90 %, blight spores thrive' : v >= 80 ? 'Elevated' : 'In range'),
    lines: [{ at: 90, label: 'blight threshold 90 %' }],
    domain: [0, 100],
    pad: 5,
  },
  {
    key: 'temperature_c',
    label: 'Temperature',
    unit: '°C',
    decimals: 1,
    status: (v) => (v <= 5 || v >= 38 ? 'alert' : v >= 18 && v <= 22 ? 'warn' : 'ok'),
    note: (v) => (v >= 18 && v <= 22 ? '18 to 22 °C favours blight' : 'In range'),
    band: { from: 18, to: 22, label: 'blight range' },
    domain: [-10, 50],
    pad: 2,
  },
  {
    key: 'soil_pct',
    label: 'Soil moisture',
    unit: '%',
    decimals: 0,
    status: (v) => (v <= 12 ? 'alert' : v <= 20 ? 'warn' : 'ok'),
    note: (v) => (v <= 12 ? 'Very dry root zone' : v <= 20 ? 'Getting dry' : 'In range'),
    lines: [{ at: 20, label: 'dry below 20 %' }],
    domain: [0, 100],
    pad: 6,
  },
  {
    key: 'rain',
    label: 'Leaf wetness plate',
    unit: '',
    decimals: 0,
    binary: true,
    status: (v) => (v ? 'warn' : 'ok'),
    note: (v) => (v ? 'Leaves wet' : 'Leaves dry'),
    domain: [0, 1],
  },
];

export const STATUS_COLOR = { ok: '#2FAB16', warn: '#E08400', alert: '#CF0033' };
