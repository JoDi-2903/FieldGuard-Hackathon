// Mock "everything the officer needs to know" per farm: contact, crop status,
// sensor readings (last 7 days, oldest first), sensor alerts, the latest farmer call
// and the steps to take. Sensor status: 'ok' | 'warn' | 'alert'.
// call.lines[].t = second in the recording where the line starts (drives the live transcript).
// call.audio = URL of the recording; null until the real audio is uploaded.
// call.summary: wrap key phrases in **…** to show them in bold.
import ownerF02 from '../assets/owners/f02.jpg';
import ownerF04 from '../assets/owners/f04.jpg';
import ownerF14 from '../assets/owners/f14.jpg';
import ownerF05 from '../assets/owners/f05.jpg';

export const SENSOR_META = {
  humidity: { label: 'Humidity', unit: '%', hint: 'night-time average' },
  temperature: { label: 'Temperature', unit: '°C', hint: 'daily mean' },
  leafWetness: { label: 'Leaf wetness', unit: 'h/day', hint: 'hours wet per day' },
  soilMoisture: { label: 'Soil moisture', unit: '%', hint: 'root zone, 20 cm' },
};

const DETAILS = {
  // f01 is backed by the real box-01 Arduino (field-a). Sensors, risk and the AI finding
  // come from the live backend; these static values are only the offline fallback.
  f01: {
    phone: '0701 332 884',
    address: 'Upper Valley, past the borehole, Field District North',
    stage: 'Planted 15 Sep · young plants',
    lastVisit: '4 Oct — sensor box installed and checked',
    sensorsUpdated: 'waiting for live data',
    sensors: {
      humidity: { value: 64, status: 'ok', note: 'In range', history: [62, 63, 65, 64, 63, 64, 64] },
      temperature: { value: 26, status: 'ok', note: 'In range', history: [25, 26, 27, 26, 26, 25, 26] },
      leafWetness: { value: 3, status: 'ok', note: 'In range', history: [2, 3, 3, 4, 3, 2, 3] },
      soilMoisture: { value: 31, status: 'ok', note: 'In range', history: [33, 32, 31, 31, 32, 31, 31] },
    },
    alerts: [],
  },
  // Riverside is now a routine farm (its sensor box moved to f01, its blight role to f04).
  f02: {
    ownerPhoto: ownerF02,
    phone: '0712 448 190',
    address: 'Plot 7, Riverside village, Field District North',
    stage: 'Planted 12 Aug · 9 weeks · flowering',
    lastVisit: '2 Oct — regular check, no issues',
    sensorsUpdated: '2 h ago',
    sensors: {
      humidity: { value: 68, status: 'ok', note: 'In range', history: [66, 67, 69, 68, 67, 68, 68] },
      temperature: { value: 26, status: 'ok', note: 'In range', history: [25, 26, 27, 26, 26, 25, 26] },
      leafWetness: { value: 3, status: 'ok', note: 'In range', history: [3, 3, 4, 3, 3, 2, 3] },
      soilMoisture: { value: 33, status: 'ok', note: 'In range', history: [31, 32, 33, 34, 33, 33, 33] },
    },
    alerts: [],
  },
  f03: {
    phone: '0723 905 316',
    address: 'Stone Hill, behind the primary school, Field District North',
    stage: 'Planted mid-July · 3 months · young plants',
    lastVisit: '25 Sep — regular check, no issues',
    sensorsUpdated: '1 h ago',
    sensors: {
      humidity: { value: 71, status: 'ok', note: 'In range', history: [68, 70, 72, 69, 70, 73, 71] },
      temperature: { value: 27, status: 'ok', note: 'In range', history: [26, 27, 28, 27, 27, 26, 27] },
      leafWetness: { value: 3, status: 'ok', note: 'In range', history: [2, 3, 3, 4, 3, 2, 3] },
      soilMoisture: { value: 18, status: 'warn', note: 'Getting dry', history: [27, 25, 23, 22, 20, 19, 18] },
    },
    sensorNote: 'Cassava mosaic spreads through whiteflies and infected cuttings, so sensors cannot detect it. The farmer report is the main signal.',
    disease: 'cassava mosaic',
    alerts: [],
    call: {
      meta: 'Farmer hotline · 14 Oct, 16:20',
      summary: 'Amina reports **yellow-green patches** and **twisted young leaves**, **spreading** from the path. Cuttings came **from a neighbour**; **many whiteflies** under the leaves.',
      audio: null,
      duration: 44,
      lines: [
        { t: 0, who: 'Farmer', text: 'Hello, this is Amina from Stone Hill. My cassava does not look good.' },
        { t: 6, who: 'WHH hotline', text: 'What do you see on the plants?' },
        { t: 10, who: 'Farmer', text: 'The young leaves are yellow with green patches, and some are twisted. It started on a few plants near the path, now more.' },
        { t: 22, who: 'WHH hotline', text: 'Where did the cuttings come from?' },
        { t: 26, who: 'Farmer', text: 'From my neighbour. I also see many small white flies under the leaves.' },
        { t: 35, who: 'WHH hotline', text: 'Please send photos. Hoang will visit you this week.' },
      ],
    },
  },
  // f04 is backed by box-02 (field-b): the late-blight showcase. Live risk + AI finding come from
  // the backend; these static sensors are the offline fallback and lean red to match.
  f04: {
    ownerPhoto: ownerF04,
    phone: '0734 210 655',
    address: 'Mango Grove, along the market road, Field District North',
    stage: 'Planted 20 Aug · 8 weeks · pods forming',
    lastVisit: '2 Oct — regular check, no issues',
    sensorsUpdated: '3 h ago',
    sensors: {
      humidity: { value: 93, status: 'alert', note: 'Above 90 % for several nights', history: [80, 85, 90, 92, 94, 93, 93] },
      temperature: { value: 20, status: 'warn', note: '18–22 °C favours blight', history: [24, 23, 22, 21, 20, 20, 20] },
      leafWetness: { value: 11, status: 'alert', note: 'Above 10 h for several days', history: [6, 7, 9, 10, 11, 12, 11] },
      soilMoisture: { value: 33, status: 'ok', note: 'In range', history: [30, 31, 33, 35, 36, 34, 33] },
    },
    disease: 'late blight',
    alerts: [],
  },
  f05: {
    ownerPhoto: ownerF05,
    phone: '0745 377 802',
    address: 'Lake Road, 2 km past the bridge, Field District North',
    stage: 'Planted mid-June · 4 months · near maturity',
    lastVisit: '2 Oct — regular check, no issues',
    sensorsUpdated: '2 h ago',
    sensors: {
      humidity: { value: 62, status: 'ok', note: 'In range', history: [60, 61, 63, 62, 61, 62, 62] },
      temperature: { value: 28, status: 'ok', note: 'In range', history: [27, 28, 29, 28, 28, 27, 28] },
      leafWetness: { value: 2, status: 'ok', note: 'In range', history: [2, 2, 3, 2, 2, 2, 2] },
      soilMoisture: { value: 22, status: 'ok', note: 'In range', history: [24, 23, 23, 22, 22, 22, 22] },
    },
    alerts: [],
  },
  // f14 is backed by box-03 (field-d): a synthetic medium-risk field. Live risk + AI finding come
  // from the backend; these static sensors are the offline fallback and lean yellow (warn, no alert).
  f14: {
    ownerPhoto: ownerF14,
    phone: '0756 120 433',
    address: 'Valley View, above the mango grove, Field District North',
    stage: 'Planted early June · 4 months · roots bulking',
    lastVisit: '3 Oct — regular check, no issues',
    sensorsUpdated: '2 h ago',
    sensors: {
      humidity: { value: 83, status: 'warn', note: 'Elevated, watch overnight', history: [74, 77, 80, 82, 84, 83, 83] },
      temperature: { value: 21, status: 'warn', note: '18–22 °C favours blight', history: [25, 24, 23, 22, 21, 21, 21] },
      leafWetness: { value: 7, status: 'warn', note: 'Rising wet hours', history: [3, 4, 5, 6, 7, 7, 7] },
      soilMoisture: { value: 27, status: 'ok', note: 'In range', history: [28, 28, 27, 27, 28, 27, 27] },
    },
    disease: 'late blight',
    alerts: [],
  },
  f15: {
    phone: '0767 884 219',
    address: 'Clay Pot Farm, near the water point, Field District North',
    stage: 'Planted late June · 4 months · heads filling',
    lastVisit: '3 Oct — regular check, no issues',
    sensorsUpdated: '1 h ago',
    sensors: {
      humidity: { value: 60, status: 'ok', note: 'In range', history: [59, 60, 61, 60, 59, 60, 60] },
      temperature: { value: 29, status: 'ok', note: 'In range', history: [28, 29, 29, 30, 29, 29, 29] },
      leafWetness: { value: 2, status: 'ok', note: 'In range', history: [2, 2, 2, 3, 2, 2, 2] },
      soilMoisture: { value: 21, status: 'ok', note: 'In range', history: [23, 22, 22, 21, 21, 21, 21] },
    },
    alerts: [],
  },
};

export function farmDetails(farmId) {
  const d = DETAILS[farmId];
  if (!d) return null;
  return { ...d, calls: [d.call, ...(d.olderCalls ?? [])].filter(Boolean) };
}

// Sensor-based risk only: any alert → HIGH, any warning → MEDIUM, else LOW.
export function riskFromSensors(sensors) {
  const statuses = Object.values(sensors ?? {}).map((s) => s.status);
  if (statuses.includes('alert')) return 'HIGH';
  if (statuses.includes('warn')) return 'MEDIUM';
  return 'LOW';
}
