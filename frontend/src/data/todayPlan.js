// Today's visits in route order (sequenced by distance, not by urgency).
// Field reality: ~60 min per visit (45–90), ~30 min driving (20–45, double in
// rainy season), 3–5 visits a day at most. 20 farms on a 2-week cycle need
// only 2 visits a day, so the remaining slots go to farms that need action.
//
// type: 'regular' | 'warning' (sensors flagged a risk) | 'help' (farmer reached out)
// summary: one-line data-based finding for the list; finding/focus: detail for the farm profile.
// travelMin / travelKm: the drive to this farm from the previous stop.
export const TODAY_PLAN = {
  visits: [
    {
      farmId: 'f02',
      summary: 'Late blight risk — sensors flag 4 days of leaf wetness',
      type: 'warning',
      durationMin: 60,
      travelMin: 30,
      travelKm: 14,
      finding: 'Leaf wetness above 10 h/day for 4 days at 18–22 °C — high risk of late blight.',
      focus: 'Inspect lower leaves, advise preventive spraying and wider spacing for airflow.',
    },
    {
      farmId: 'f03',
      summary: 'Farmer reports yellow, mottled leaves — possible cassava mosaic',
      type: 'help',
      durationMin: 90,
      travelMin: 25,
      travelKm: 11,
      finding: 'Farmer sent photos of yellow, mottled leaves on young plants (2 days ago).',
      focus: 'Check for cassava mosaic disease, remove infected plants, source clean cuttings.',
    },
    {
      farmId: 'f04',
      summary: 'Regular visit — all data normal',
      type: 'regular',
      durationMin: 45,
      travelMin: 25,
      travelKm: 10,
      finding: 'All sensor readings normal and no concerns reported. Pods are forming.',
      focus: 'Routine check and timing for dry-bean harvest.',
    },
    {
      farmId: 'f05',
      summary: 'Regular visit — all data normal',
      type: 'regular',
      durationMin: 60,
      travelMin: 30,
      travelKm: 13,
      finding: 'All readings normal. Crop is close to maturity.',
      focus: 'Bird protection, drying and safe storage.',
    },
  ],
  returnTravelMin: 40,
  returnTravelKm: 18,
};
