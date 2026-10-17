// Mock data for Hoang's 20 assigned farms. Names and places are placeholders.
// `pos` is a position on the schematic route map (viewBox 700 × 300).
export const FIELD_OFFICE = { name: 'WHH field office', pos: { x: 50, y: 250 } };

export const FARMS = [
  { id: 'f01', name: 'Hillside Farm', owner: 'Grace Achieng', village: 'Upper Valley', crop: 'Maize', hectares: 1.2, pos: { x: 120, y: 192 } },
  { id: 'f02', name: 'Riverside Plot', owner: 'Grace Banda', village: 'Riverside', crop: 'Maize', hectares: 0.8, pos: { x: 178, y: 112 } },
  { id: 'f03', name: 'Stone Hill Farm', owner: 'Amina Hassan', village: 'Stone Hill', crop: 'Cassava', hectares: 1.5, pos: { x: 262, y: 64 } },
  { id: 'f04', name: 'Mango Grove', owner: 'Peter Okoth', village: 'Mango Grove', crop: 'Beans', hectares: 0.6, pos: { x: 338, y: 128 } },
  { id: 'f05', name: 'Lake Road Farm', owner: 'Mary Phiri', village: 'Lake Road', crop: 'Sorghum', hectares: 2.1, pos: { x: 410, y: 58 } },
  { id: 'f06', name: 'Red Earth Farm', owner: 'Samuel Kariuki', village: 'Red Earth', crop: 'Maize', hectares: 1.8, pos: { x: 500, y: 96 } },
  { id: 'f07', name: 'Twin Wells', owner: 'Esther Mutua', village: 'Twin Wells', crop: 'Tomatoes', hectares: 0.5, pos: { x: 590, y: 52 } },
  { id: 'f08', name: 'Baobab Corner', owner: 'David Tembo', village: 'Baobab Corner', crop: 'Maize', hectares: 1.4, pos: { x: 648, y: 150 } },
  { id: 'f09', name: 'Green Ridge', owner: 'Fatuma Ali', village: 'Green Ridge', crop: 'Coffee', hectares: 1.0, pos: { x: 566, y: 230 } },
  { id: 'f10', name: 'Market Junction', owner: 'John Njoroge', village: 'Market Junction', crop: 'Beans', hectares: 0.9, pos: { x: 440, y: 216 } },
  { id: 'f11', name: 'Sunrise Field', owner: 'Ruth Chanda', village: 'Upper Valley', crop: 'Groundnuts', hectares: 0.7, pos: { x: 92, y: 96 } },
  { id: 'f12', name: 'Acacia Farm', owner: 'Moses Lungu', village: 'Riverside', crop: 'Maize', hectares: 2.4, pos: { x: 232, y: 196 } },
  { id: 'f13', name: 'Blue Gum Plot', owner: 'Halima Omar', village: 'Stone Hill', crop: 'Sweet potatoes', hectares: 0.6, pos: { x: 300, y: 250 } },
  { id: 'f14', name: 'Valley View', owner: 'Isaac Mensah', village: 'Mango Grove', crop: 'Cassava', hectares: 1.1, pos: { x: 360, y: 34 } },
  { id: 'f15', name: 'Clay Pot Farm', owner: 'Agnes Mbeki', village: 'Lake Road', crop: 'Sorghum', hectares: 1.6, pos: { x: 470, y: 150 } },
  { id: 'f16', name: 'Windmill Farm', owner: 'Daniel Otieno', village: 'Red Earth', crop: 'Beans', hectares: 0.8, pos: { x: 540, y: 160 } },
  { id: 'f17', name: 'Hilltop Orchard', owner: 'Lucy Wairimu', village: 'Twin Wells', crop: 'Avocado', hectares: 1.3, pos: { x: 668, y: 40 } },
  { id: 'f18', name: 'Dry Creek Farm', owner: 'Emmanuel Sesay', village: 'Baobab Corner', crop: 'Millet', hectares: 2.0, pos: { x: 660, y: 262 } },
  { id: 'f19', name: 'Palm Row', owner: 'Rose Njeri', village: 'Green Ridge', crop: 'Coffee', hectares: 0.9, pos: { x: 500, y: 270 } },
  { id: 'f20', name: 'Long Furrow', owner: 'Paul Kamau', village: 'Market Junction', crop: 'Maize', hectares: 1.7, pos: { x: 370, y: 196 } },
];

export const farmById = Object.fromEntries(FARMS.map((f) => [f.id, f]));

// Farms whose risk level is hardcoded for the demo: the status is pinned and never
// recomputed from live readings (the sensor tiles themselves still stream). HIGH => red.
export const FORCED_RISK = { f01: 'HIGH' };
