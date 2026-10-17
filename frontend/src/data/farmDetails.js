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
  f02: {
    ownerPhoto: ownerF02,
    phone: '0712 448 190',
    address: 'Plot 7, Riverside village, Field District North',
    stage: 'Planted 12 Aug · 9 weeks · flowering',
    lastVisit: '2 Oct — regular check, no issues',
    sensorsUpdated: '2 h ago',
    sensors: {
      humidity: { value: 94, status: 'alert', note: 'Above 90 % for 6 nights', history: [78, 82, 88, 91, 93, 95, 94] },
      temperature: { value: 20, status: 'warn', note: '18–22 °C favours blight', history: [24, 23, 22, 21, 20, 20, 20] },
      leafWetness: { value: 11.5, status: 'alert', note: 'Above 10 h for 4 days', history: [6, 7, 9, 10.5, 11, 12, 11.5] },
      soilMoisture: { value: 34, status: 'ok', note: 'In range', history: [30, 31, 33, 35, 36, 35, 34] },
    },
    disease: 'late blight',
    // Hardcoded for now: why these readings point to late blight.
    finding: {
      title: 'Weather is ideal for late blight to infect the maize',
      reasons: [
        { icon: 'humidity', status: 'alert', label: 'Humid nights', text: '**Above 90 %** for **6 nights**. Spores thrive in damp air.' },
        { icon: 'temperature', status: 'warn', label: 'Cool days', text: '**18 to 22 °C**, the ideal range for spores.' },
        { icon: 'leaf', status: 'alert', label: 'Wet leaves', text: 'Wet **11.5 h a day**. Spores need only **10 h** to infect.' },
      ],
    },
    alerts: [
      { who: 'Sensor', at: '13 Oct, 06:00', text: 'Leaf wetness above 10 h — day 2.' },
      { who: 'Sensor', at: '15 Oct, 06:00', text: 'Leaf wetness above 10 h — day 4. Late blight risk raised to HIGH.' },
      { who: 'System', at: '15 Oct, 06:05', text: 'SMS sent to farmer: avoid overhead watering, officer visit planned.' },
    ],
    call: {
      meta: 'Farmer hotline · 15 Oct, 07:40',
      summary: 'Grace observed **dark, water-soaked spots** on the **lower leaves** and a **white fuzz** underneath, after **foggy mornings**. **Not sprayed** yet.',
      audio: null,
      duration: 52,
      lines: [
        { t: 0, who: 'Farmer', text: 'Good morning, this is Grace from Riverside. I got the SMS about my maize.' },
        { t: 7, who: 'WHH hotline', text: 'Thank you for calling. What do you see on the plants?' },
        { t: 12, who: 'Farmer', text: 'Some lower leaves have dark spots, they look wet, like burnt. It started two days ago.' },
        { t: 21, who: 'WHH hotline', text: 'Do you see anything under the leaves?' },
        { t: 25, who: 'Farmer', text: 'Yes, a little white fuzz on some of them. The mornings have been very foggy.' },
        { t: 33, who: 'WHH hotline', text: 'Have you sprayed anything yet?' },
        { t: 36, who: 'Farmer', text: 'No, nothing yet. I water in the evening with the can.' },
        { t: 42, who: 'WHH hotline', text: 'Please stop watering from above for now. Felix will visit you this morning.' },
      ],
    },
    // earlier calls since the last visit (newest first after `call`)
    olderCalls: [
      {
        meta: 'Farmer hotline · 11 Oct, 17:05',
        summary: 'Grace observed **leaves curling** after **two misty nights** and asked whether to **water less**. No spots yet.',
        audio: null,
        duration: 31,
        lines: [
          { t: 0, who: 'Farmer', text: 'Hello, this is Grace from Riverside. Some maize leaves are curling.' },
          { t: 8, who: 'WHH hotline', text: 'Do you see any spots on them?' },
          { t: 12, who: 'Farmer', text: 'No spots. It was misty the last two nights. Should I water less?' },
          { t: 21, who: 'WHH hotline', text: 'Water in the morning only. Call us if spots appear.' },
        ],
      },
    ],
    steps: [
      { title: 'Apply “Protectant” Sprays', sub: 'The Invisible Shield' },
      { title: 'Dry Out the Field', sub: 'Change the Microclimate' },
      { title: 'Pause High-Nitrogen Fertilizers' },
      { title: 'Lock Down Field Movement' },
      { title: 'Intensify Lower-Canopy Scouting' },
    ],
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
        { t: 35, who: 'WHH hotline', text: 'Please send photos. Felix will visit you this week.' },
      ],
    },
  },
  f04: {
    ownerPhoto: ownerF04,
    phone: '0734 210 655',
    address: 'Mango Grove, along the market road, Field District North',
    stage: 'Planted 20 Aug · 8 weeks · pods forming',
    lastVisit: '2 Oct — regular check, no issues',
    sensorsUpdated: '3 h ago',
    sensors: {
      humidity: { value: 66, status: 'ok', note: 'In range', history: [64, 65, 67, 66, 65, 66, 66] },
      temperature: { value: 25, status: 'ok', note: 'In range', history: [25, 26, 25, 24, 25, 25, 25] },
      leafWetness: { value: 4, status: 'ok', note: 'In range', history: [3, 4, 5, 4, 4, 3, 4] },
      soilMoisture: { value: 29, status: 'ok', note: 'In range', history: [31, 30, 30, 29, 30, 29, 29] },
    },
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
  f14: {
    ownerPhoto: ownerF14,
    phone: '0756 120 433',
    address: 'Valley View, above the mango grove, Field District North',
    stage: 'Planted early June · 4 months · roots bulking',
    lastVisit: '3 Oct — regular check, no issues',
    sensorsUpdated: '2 h ago',
    sensors: {
      humidity: { value: 68, status: 'ok', note: 'In range', history: [66, 67, 69, 68, 67, 68, 68] },
      temperature: { value: 26, status: 'ok', note: 'In range', history: [26, 27, 26, 25, 26, 26, 26] },
      leafWetness: { value: 3, status: 'ok', note: 'In range', history: [3, 3, 4, 3, 3, 2, 3] },
      soilMoisture: { value: 27, status: 'ok', note: 'In range', history: [28, 28, 27, 27, 28, 27, 27] },
    },
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
