// Which demo farms are backed by a real sensor box in the Azure backend.
//
// The dashboard ships 20 placeholder farms (data/farms.js); the backend has a
// handful of configured fields, only some of which have a device. Mapped farms
// show LIVE backend data (sensors, risk, AI alerts/call/steps) overlaid on the
// static scaffold; unmapped farms keep their static placeholder values.
//
// Keys are farm ids (data/farms.js), values are backend field ids (GET /api/fields).
export const FARM_FIELD_MAP = {
  f02: 'field-b', // Riverside / maize -> blight showcase field (box-02)
  f04: 'field-a', // Mango Grove -> healthy reference field (box-01)
};

export const fieldIdForFarm = (farmId) => FARM_FIELD_MAP[farmId] ?? null;

// Sensor box behind each backend field (azure/functionapp/seed_fields.py).
export const DEVICE_FOR_FIELD = {
  'field-a': 'box-01',
  'field-b': 'box-02',
};

export const deviceIdForFarm = (farmId) => DEVICE_FOR_FIELD[fieldIdForFarm(farmId)] ?? null;
