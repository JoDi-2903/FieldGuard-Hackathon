// Which demo farms are backed by a real sensor box in the Azure backend.
//
// The dashboard ships 20 placeholder farms (data/farms.js); the backend has a
// handful of configured fields, only some of which have a device. Mapped farms
// show LIVE backend data (sensors, risk, AI alerts/call/steps) overlaid on the
// static scaffold; unmapped farms keep their static placeholder values.
//
// Demo roles:
//   f01 Hillside     -> field-a -> box-01 : the REAL Arduino, live hero (not demo-seeded)
//   f04 Mango Grove  -> field-b -> box-02 : synthetic RED (late-blight showcase)
//   f14 Valley View  -> field-d -> box-03 : synthetic YELLOW
//
// Keys are farm ids (data/farms.js), values are backend field ids (GET /api/fields).
export const FARM_FIELD_MAP = {
  f01: 'field-a', // Hillside Farm -> real box-01 (physically changing it shows here live)
  f04: 'field-b', // Mango Grove -> blight showcase (box-02), red
  f14: 'field-d', // Valley View -> synthetic medium-risk field (box-03), yellow
};

export const fieldIdForFarm = (farmId) => FARM_FIELD_MAP[farmId] ?? null;

// Sensor box behind each backend field (azure/functionapp/seed_fields.py).
export const DEVICE_FOR_FIELD = {
  'field-a': 'box-01',
  'field-b': 'box-02',
  'field-d': 'box-03',
};

export const deviceIdForFarm = (farmId) => DEVICE_FOR_FIELD[fieldIdForFarm(farmId)] ?? null;
