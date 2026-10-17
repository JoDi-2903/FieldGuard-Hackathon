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
      summary: 'Live sensor box. Leaf wetness high and root zone dry.',
      type: 'warning',
      durationMin: 45,
      travelMin: 20,
      travelKm: 7,
      finding: 'Long leaf wetness and a very dry root zone. Elevated risk.',
      focus: 'Check the crop and sensor box. Advise on watering.',
    },
    {
      farmId: 'f04',
      summary: 'Late blight risk. Several wet nights flagged.',
      type: 'warning',
      durationMin: 60,
      travelMin: 25,
      travelKm: 10,
      finding: 'Humid nights and long leaf wetness. High late blight risk.',
      focus: 'Check lower leaves. Advise spraying and wider spacing.',
    },
    {
      farmId: 'f14',
      summary: 'Early blight signal. A few borderline nights.',
      type: 'warning',
      durationMin: 45,
      travelMin: 20,
      travelKm: 8,
      finding: 'A few risky nights building up. Medium risk, worth a look.',
      focus: 'Check young leaves for spots. Advise morning watering.',
    },
    {
      farmId: 'f05',
      summary: 'Regular visit. All data normal.',
      type: 'regular',
      durationMin: 60,
      travelMin: 20,
      travelKm: 7,
      finding: 'All readings normal. Crop near maturity.',
      focus: 'Bird protection, drying and safe storage.',
    },
    {
      farmId: 'f15',
      summary: 'Regular visit. All data normal.',
      type: 'regular',
      durationMin: 45,
      travelMin: 25,
      travelKm: 9,
      finding: 'All readings normal. Heads filling.',
      focus: 'Harvest timing and storage pests.',
    },
  ],
  returnTravelMin: 40,
  returnTravelKm: 20,
};
