# FieldGuard — Azure Backend

Sensor data from Arduino boxes flows into Azure Table Storage, gets scored every 20 minutes (a deterministic blight-night rule plus an Azure OpenAI explanation — risk, a step-by-step action plan, a per-field alert feed, and a simulated farmer-call transcript), and is shown on a React dashboard ranked by risk. The dashboard is a static single-page app hosted on Azure Static Web Apps, which proxies `/api` to the Function App as a linked backend (same origin, no CORS), and auto-refreshes by polling the API. Each box fetches its own colour back for its LED traffic light.

```
Arduino → POST /api/ingest → Table Storage ─┐
                                            ├─ scorer (timer + /api/score_now): blight-night rule + Azure OpenAI
Dashboard (Static Web App, Standard)        │       → riskscores table (color, score, steps, alerts, call)
  │  served static SPA (React/Vite)         │
  └─ /api/* ─(linked backend proxy)─────────┴─→ Function App
        GET /api/risk            ranked risk list (+ steps)
        GET /api/farms/{id}      aggregated per-field detail (sensors, disease, alerts, call, steps)
        GET /api/fields          configured fields
        GET /api/readings        raw time-series
Arduino LEDs ← GET /api/light ───────────────→ most-urgent colour per box
```

### How a field is scored

1. `blight_rule.py` counts **blight nights**: noon-to-noon windows (Kasungu time) with ≥ 6 h of leaf-plate wetness (`rain = 1`) at a mean 18–27 °C while wet. Wet time comes from the reading timestamps, so any cadence works (5 s demo, 15 min field). Last 7 nights: 0–1 green, 2–3 yellow, 4+ red.
2. `scoring.py` adds descriptive signals for the last 48 h (stats, humidity hours, staleness, stuck sensors) and asks the LLM for a score and explanation.
3. The rule's colour is a **floor**: it can raise the LLM's colour (score at least 40 for yellow, 70 for red), never lower it.

A field with `demoMode: true` uses 10-minute "nights" (3 wet minutes = 1 blight night, 1 → yellow, 2 → red), so spraying the plate shows up live.

## Live deployment

| Resource | URL |
|---|---|
| API base | `https://fieldguard-func-32vxg3.azurewebsites.net/api` |
| Dashboard | `https://polite-beach-0c71e671e.2.azurestaticapps.net` |
| Storage account | `fieldguardst32vxg3` (Resource Group: `CE-team-bug-busters`) |

## Folder layout

| Path | What |
|---|---|
| `terraform/` | All Azure infrastructure (Terraform `azurerm ~> 4.0`) |
| `functionapp/` | Python v2 Azure Functions: `ingest`, `readings`, `risk`, `light`, `fields`, `farms/{id}`, `score_now`, `score_timer`; `blight_rule.py`; tests in `tests/` |
| `scripts/replay_blight_nights.py` | Demo: posts a week with blight nights for `box-02`, rescores, prints the result |
| `../frontend/` | React 18 + Vite dashboard (`whh-field-guard`) — the deployed Static Web App content |

Secrets live in gitignored files — only `*.template` siblings are committed:
`terraform/terraform.tfvars`, `functionapp/local.settings.json`. The React app needs no
secrets; `../frontend/.env.example` documents the optional local-dev variables.

---

## Prerequisites (first-time setup)

- [Azure CLI](https://learn.microsoft.com/cli/azure) — `az login` before running anything
- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.6
- [Node.js](https://nodejs.org/) >= 18 — runs `func` and `swa` via `npx`, and builds the React dashboard
- Python 3.12 — for `seed_fields.py` and `seed_telemetry.py`

> **No global installs required.** The deploy steps below use `npx` so you don't need
> `func` or `swa` pre-installed globally.

---

## Deploy from scratch

```bash
az login

# 1. Provision all Azure resources (Standard Static Web App + linked-backend
#    registration to the Function App are created here)
cd terraform
cp terraform.tfvars.template terraform.tfvars
#    → fill in: subscription_id (required), resource_group_name, regions (optional)
terraform init
terraform apply

# 2. Set the ingest secret (done out-of-band so it never lands in tfstate)
az functionapp config appsettings set \
  -g "$(terraform output -raw resource_group_name)" \
  -n "$(terraform output -raw function_app_name)" \
  --settings INGEST_SHARED_SECRET=<choose-any-strong-secret>

# 2b. Linking a backend auto-enables App Service Auth (AuthV2) on the Function App.
#     Ensure it still allows anonymous callers, so the direct Arduino ingest path and
#     the public read endpoints keep working (Terraform ignores auth drift by design):
az webapp auth update \
  -g "$(terraform output -raw resource_group_name)" \
  -n "$(terraform output -raw function_app_name)" \
  --unauthenticated-client-action AllowAnonymous

# 3. Seed the demo fields and deploy the function code
cd ../functionapp
export TELEMETRY_CONNECTION_STRING="$(cd ../terraform && terraform output -raw telemetry_connection_string)"
pip install azure-data-tables   # one-time, if not already installed
python seed_fields.py
npx -y azure-functions-core-tools@4 azure functionapp publish \
  "$(cd ../terraform && terraform output -raw function_app_name)" --python

# 4. Build and deploy the React dashboard (its dist/ becomes the SWA content).
#    The linked /api only resolves once the SWA has an app deployed, so this must
#    run before the dashboard can reach the backend.
cd ../../frontend
npm install
npm run build
npx -y @azure/static-web-apps-cli deploy ./dist \
  --deployment-token "$(cd ../azure/terraform && terraform output -raw swa_deployment_token)" \
  --env production

# 5. Seed demo telemetry through the live API and compute the first scores so the
#    dashboard's live overlay has data to show immediately.
cd ../azure/functionapp
export API_BASE_URL="$(cd ../terraform && terraform output -raw api_base_url)"
export INGEST_SHARED_SECRET=<the-same-secret-from-step-2>
python seed_telemetry.py
```

> **Cold-start:** The Function App on a Consumption plan can take a few seconds on the
> first request after a fresh deploy. If you get a timeout, just retry.

> **Local development:** run the Function App locally (`func start`, port 7071) and, in
> `../frontend`, `npm run dev`. Vite proxies `/api` to the local host (override with
> `VITE_API_PROXY` in `.env`, e.g. point it at the deployed Function App). Sign in with
> the demo officer `felix` / `demo`.

---

## Arduino HTTP contract

The Arduino firmware posts sensor readings to:

```
POST https://<function-app-hostname>/api/ingest
Content-Type: application/json
X-Ingest-Key: <your-secret>
```

**Request body — JSON array of readings:**

```json
[
  {
    "deviceId":      "box-01",
    "timestamp":     "2026-10-16T12:00:00Z",
    "temperature_c": 24.5,
    "humidity_pct":  82.0,
    "rain":          0,
    "soil_pct":      41.2
  }
]
```

| Field | Type | Notes |
|---|---|---|
| `deviceId` | string | Unique box identifier, e.g. `box-01` |
| `timestamp` | string | ISO-8601, UTC, from the RTC (`Z` suffix or `+00:00`) |
| `temperature_c` | number | Air temperature in °C |
| `humidity_pct` | number | Relative humidity 0–100 |
| `rain` | integer | `0` = dry, `1` = wet |
| `soil_pct` | number | Soil moisture 0–100 |

**Why an array?** If the box loses connectivity and buffers readings locally, the entire
backlog can be drained in one request when it reconnects.

**Success response:**
```json
{ "written": 1 }
```

---

## API reference

All endpoints are under `https://<function-app-hostname>/api`. No Azure function key needed — auth is either open (read) or via the `X-Ingest-Key` header (write).

### POST `/api/ingest` — store sensor readings

Write-protected (`X-Ingest-Key` required). Accepts a JSON array as described above.

```bash
curl -X POST "$BASE/ingest" \
  -H "X-Ingest-Key: $SECRET" \
  -H "Content-Type: application/json" \
  -d '[{"deviceId":"box-01","timestamp":"2026-10-16T12:00:00Z","temperature_c":24.5,"humidity_pct":82.0,"rain":0,"soil_pct":41.2}]'
# → {"written": 1}
```

### GET `/api/readings` — time-series for a device

Returns readings newest-first.

| Query param | Required | Default | Description |
|---|---|---|---|
| `deviceId` | yes | — | e.g. `box-01` |
| `limit` | no | `200` | Max number of readings to return |
| `start` | no | — | ISO-8601 start of time window |
| `end` | no | now | ISO-8601 end of time window (only with `start`) |

```bash
curl "$BASE/readings?deviceId=box-01&limit=5"
```

```json
[
  {
    "deviceId":        "box-01",
    "deviceTimestamp": "2026-10-16T12:00:00+00:00",
    "serverTimestamp": "2026-10-16T12:00:01.234+00:00",
    "temperature_c":   24.5,
    "humidity_pct":    82.0,
    "rain":            0,
    "soil_pct":        41.2,
    "quality":         "ok"
  }
]
```

`quality` is `"ok"`, `"missing"` (required sensor absent), or `"implausible"` (value out of physical range).

### GET `/api/risk` — ranked field visit list

Returns all configured fields with their latest AI-computed risk score, sorted most-urgent first.

```bash
curl "$BASE/risk"
```

```json
[
  {
    "fieldId":            "field-b",
    "fieldName":          "Field B - River plot",
    "crop":               "potato",
    "color":              "red",
    "score":              85,
    "reasoning":          "High humidity combined with rain event ...",
    "recommended_action": "Inspect for late blight, consider fungicide application",
    "data_caveats":       null,
    "steps": [
      { "title": "Inspect lower leaves", "sub": "Look for dark, water-soaked lesions" },
      { "title": "Advise preventive spraying", "sub": "" }
    ],
    "scoredAt":           "2026-10-16T12:20:00+00:00"
  }
]
```

`color` is `"green"`, `"yellow"`, or `"red"`. `score` is 0–100 (100 = highest risk). `steps` is the AI-generated action plan (most important first).

### GET `/api/fields` — configured fields

Lists the fields in the `fields` table (used by the dashboard to map farms to fields).

```bash
curl "$BASE/fields"
```

```json
[
  { "fieldId": "field-b", "name": "Field B - River plot", "crop": "potato",
    "plantingDate": "2026-09-20", "deviceId": "box-02",
    "knownCases": "late blight confirmed on neighbouring farm" }
]
```

### GET `/api/farms/{fieldId}` — aggregated per-field detail

Returns everything the dashboard's farm profile renders, assembled from the readings
window and the latest cached risk row (sensors with 7-day sparkline history + status,
disease headline, AI alert feed, farmer-call transcript, and the step plan). Fields
without a device return `"sensors": null` and a `sensorNote`.

```bash
curl "$BASE/farms/field-b"
```

```json
{
  "fieldId": "field-b",
  "crop": "potato",
  "stage": "Planted 20 Sep · 3 weeks · potato",
  "sensorsUpdated": "4 min ago",
  "sensors": {
    "humidity":    { "value": 95.5, "status": "alert", "note": "Above 90 % — leaf-wetness risk", "history": [82,84,88,90,93,95,95] },
    "temperature": { "value": 20.0, "status": "warn",  "note": "18–22 °C favours blight", "history": [20,20,20,20,20,20,20] },
    "leafWetness": { "value": 10.1, "status": "alert", "note": "Above 10 h/day", "history": [3,3,3,8,12,12,10] },
    "soilMoisture":{ "value": 41.0, "status": "ok",    "note": "In range", "history": [41,41,41,41,41,41,41] }
  },
  "disease": "late blight",
  "risk": { "color": "red", "score": 85, "reasoning": "...", "recommended_action": "...", "data_caveats": "" },
  "alerts": [ { "who": "Sensor", "at": "15 Oct, 06:00", "text": "Leaf wetness above 10 h — day 2." } ],
  "call":   { "meta": "Farmer hotline · ...", "summary": "...", "audio": null, "duration": 52, "lines": [ { "t": 0, "who": "Farmer", "text": "..." } ] },
  "steps":  [ { "title": "Inspect lower leaves", "sub": "..." } ]
}
```

The four sensor tiles map to the backend as: `humidity`←`humidity_pct`, `temperature`←`temperature_c`,
`soilMoisture`←`soil_pct`, and `leafWetness` is a **proxy** (hours/day with humidity ≥ 90 % or rain —
there is no physical leaf-wetness sensor). `status` is `"ok" | "warn" | "alert"`.

`deviceId` and `blight_nights` (count in the last 7 nights, from the rule) are included per field.

### GET `/api/light` — colour for one box's LED traffic light

Plain text, one word: `red`, `yellow`, `green`, or `unknown` (no score yet). If a box serves several fields, the most urgent colour wins. The `cloud_node` sketch polls this every 30 s.

```bash
curl "$BASE/light?deviceId=box-01"
# → yellow
```

### POST `/api/score_now` — trigger scoring immediately

Write-protected (`X-Ingest-Key` required). Runs the AI scorer for all fields right now instead of waiting for the 20-minute timer.

```bash
curl -X POST "$BASE/score_now" -H "X-Ingest-Key: $SECRET"
# → {"scored": [{"fieldId": "field-a", "color": "green", "score": 12}, ...]}
```

---

## Demo: replay blight nights

```bash
python3 azure/scripts/replay_blight_nights.py              # box-02 (field-b): 4 blight nights => red
python3 azure/scripts/replay_blight_nights.py --nights 2   # => yellow
python3 azure/scripts/replay_blight_nights.py --dry-run    # print only
```

Posts 15-minute readings (wet 20:00–04:00 at 22 °C) for the last N nights, calls `/api/score_now`, then prints `/api/risk` and `/api/light`. Key from `$INGEST_KEY` or `arduino_secrets.h`.

## Tests

```bash
cd azure/functionapp
pip install -r requirements.txt pytest
python -m pytest tests
```

---

## Notes & known constraints

- **Existing resource group**: Terraform reads a pre-existing RG via a data source and never creates or destroys it. Hackathon accounts typically cannot create new RGs.
- **Key-based auth (no managed identity)**: assigning data-plane RBAC roles requires `Microsoft.Authorization/roleAssignments/write`, which hackathon accounts usually lack. Storage and OpenAI are therefore accessed via account keys stored in gitignored tfstate and app settings — never in the repo.
- **Python 3.12**: the Linux Consumption plan supports up to Python 3.12. The remote build on Azure always uses 3.12 regardless of your local Python version.
- **Azure OpenAI region**: the chosen model must be available and within TPM quota in `openai_location` (`swedencentral` by default).
- **Static Web App (Standard) + linked backend**: the SWA is Standard because linking an existing ("bring your own") Function App as the `/api` backend is not available on the Free tier. `swa_location` defaults to `westus2`.
- **Cognitive account soft-delete**: after `terraform destroy`, reusing the same account name in the same region can fail for ~48 h. Use `az cognitiveservices account purge ...` or change the project name to generate a new suffix.
- **Routing (same-origin `/api`)**: the dashboard calls `/api` same-origin through the SWA linked-backend proxy — no CORS needed. The Function App's own CORS allow-list still covers direct device ingest and local development.
- **AuthV2 anonymous access**: linking the backend auto-enables App Service Authentication on the Function App. Terraform ignores `auth_settings_v2` drift so it won't fight the linkage; keep `--unauthenticated-client-action AllowAnonymous` (deploy step 2b) so direct device ingest and the public read endpoints keep working.
- **Real-time**: the dashboard polls `/api/risk` and `/api/farms/{id}` every ~20 s for the latest readings and scores. Server push (WebSocket/SignalR) is not used — and isn't supported through the SWA `/api` proxy — so a static SPA needs no container hosting.
- **Demo telemetry**: readings exist only once a device posts to `/api/ingest`. `seed_telemetry.py` generates a few days of realistic readings (a healthy `box-01` and a blight-favourable `box-02`) so the dashboard's live overlay has data without the physical Arduino.
