// Today's visits in route order (sequenced by distance, not by urgency).
// Field reality: ~60 min per visit (45–90), ~30 min driving (20–45, double in
// rainy season), 3–5 visits a day at most. 20 farms on a 2-week cycle need
// only 2 visits a day, so the remaining slots go to farms that need action.
//
// type: 'regular' | 'warning' (sensors flagged a risk) | 'help' (farmer reached out)
// summary: one-line data-based finding for the list; finding/focus: detail for the farm profile.
// travelMin / travelKm: the drive to this farm from the previous stop.
//
// For sensor-backed farms (f01, f04, f14 — see data/farmFieldMap.js) these strings are only an
// offline fallback: Dashboard.overlayPlan() replaces summary/finding/focus with the Azure model's
// live reasoning/recommended_action, and the type follows the live risk colour.
//
// Not on today's route: Stone Hill Farm (f03, help request about cassava mosaic) —
// its details and call recording stay in farmDetails.js; add it back here to schedule it.
export const TODAY_PLAN = {
  visits: [
    {
      farmId: 'f01',
      summary: 'Live sensor box — readings streaming from the field',
      type: 'regular',
      durationMin: 45,
      travelMin: 20,
      travelKm: 7,
      finding: 'Real sensor box reporting live. Readings currently in range.',
      focus: 'Routine check; confirm the sensor box and solar panel are seated well.',
    },
    {
      farmId: 'f04',
      summary: 'Late blight risk — sensors flag several nights of leaf wetness',
      type: 'warning',
      durationMin: 60,
      travelMin: 25,
      travelKm: 10,
      finding: 'Repeated humid nights at 18–22 °C with long leaf wetness — high risk of late blight.',
      focus: 'Inspect lower leaves, advise preventive spraying and wider spacing for airflow.',
    },
    {
      farmId: 'f14',
      summary: 'Early blight signal — a couple of borderline nights',
      type: 'warning',
      durationMin: 45,
      travelMin: 20,
      travelKm: 8,
      finding: 'A few blight-favourable nights building up — medium risk, worth a closer look.',
      focus: 'Check young leaves for early spots; advise morning-only watering.',
    },
    {
      farmId: 'f05',
      summary: 'Regular visit — all data normal',
      type: 'regular',
      durationMin: 60,
      travelMin: 20,
      travelKm: 7,
      finding: 'All readings normal. Crop is close to maturity.',
      focus: 'Bird protection, drying and safe storage.',
    },
    {
      farmId: 'f15',
      summary: 'Regular visit — all data normal',
      type: 'regular',
      durationMin: 45,
      travelMin: 25,
      travelKm: 9,
      finding: 'All readings normal. Heads are filling.',
      focus: 'Harvest timing and storage pests.',
    },
  ],
  returnTravelMin: 40,
  returnTravelKm: 20,
};
