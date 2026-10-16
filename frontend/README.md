# Field Guard — Welthungerhilfe

Dashboard for a Welthungerhilfe extension officer (Felix) who advises ~20 farmers on crop
harvesting, crop disease and farm visits. Built step by step; this is step 1: the login page.

## Run

Requires Node.js 18+.

```bash
npm install
npm run dev      # http://localhost:5173
```

Demo login: `felix` / `demo` (mock, see `src/auth/officer.js`).

## Structure

```
src/
  styles/tokens.css        WHH design tokens (from ../welthungerhilfe/output/DESIGN.md)
  styles/global.css        base type, pill buttons, text links
  assets/whh-logo.png      official WHH logo (header); public/favicon.png = cropped mark (browser tab)
  components/              Logo, AppHeader, DayCalendar, RouteMap, VisitList, TypeBadge,
                           SensorTile, VisitNotes (text + voice recording), VisitPhotos, VisitVerdict
  data/farmDetails.js      contact, crop stage, sensor readings (7 days), call transcripts / alerts; risk score
  data/visitRecord.js      shape of what the officer captures during a visit
  utils/                   greeting, time formatting
  auth/officer.js          mock officer profile + sign-in
  data/farms.js            20 assigned farms (mock) + map positions
  data/todayPlan.js        today's 4 visits in route order: type, duration, drive time/km, finding, advice focus
  data/schedule.js         builds the 08:00–16:00 day (drives + visits); RAINY_SEASON doubles drive times
  data/visitTypes.js       regular check / sensor disease warning / farmer asked for help
  pages/LoginPage.jsx      login screen
  pages/Dashboard.jsx      Felix's priorities for today (calendar + route map + farm list)
  pages/FarmProfile.jsx    farm profile: preparation (farm, problem summary, transcript, risk)
                           + during the visit (notes chat with voice notes, photos, verdict)
```

## Field assumptions

- Visit ~60 min (45–90), drive ~30 min (20–45, double in rainy season), 3–5 visits per day max.
- 20 farms on a 2-week cycle need 2 regular visits a day; remaining slots go to farms that need action.
- Farms that need action (sensor disease warning or farmer asked for help) are red; regular checks green.

## Design rules carried over from the WHH site

- Green `#2FAB16` for brand and every action; red is reserved for donations on the WHH site, so it is not used here.
- Square cards, inputs and tags; pill-shaped buttons.
- White / light grey / green bands, with white cards overlapping the band edge.
- Headline font: Core Sans WHH (licensed). Stand-ins: Barlow Condensed + Nunito Sans (Google Fonts).
