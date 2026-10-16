# FieldGuard — Azure Backend

Sensor data from Arduino boxes flows into Azure Table Storage, gets scored by an Azure OpenAI model every 20 minutes, and is shown on a static dashboard ranked by risk.

```
Arduino → POST /api/ingest → Table Storage ─┐
                                            ├─ scorer (timer + /api/score_now) → Azure OpenAI → riskscores table
Dashboard (Static Web App) ← /api/risk ─────┘
                            ← /api/readings
```

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
| `functionapp/` | Python v2 Azure Functions: `ingest`, `readings`, `risk`, `score_now`, `score_timer` |
| `dashboard/` | Static HTML dashboard (ranked risk list + sensor charts) |

Secrets live in gitignored files — only `*.template` siblings are committed:
`terraform/terraform.tfvars`, `functionapp/local.settings.json`, `dashboard/config.js`.

---

## Prerequisites (first-time setup)

- [Azure CLI](https://learn.microsoft.com/cli/azure) — `az login` before running anything
- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.6
- [Node.js](https://nodejs.org/) >= 18 — used to run `func` and `swa` via `npx`
- Python 3.12 — only needed for `seed_fields.py`

> **No global installs required.** The deploy steps below use `npx` so you don't need
> `func` or `swa` pre-installed globally.

---

## Deploy from scratch

```bash
az login

# 1. Provision all Azure resources
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

# 3. Seed the demo fields and deploy the function code
cd ../functionapp
export TELEMETRY_CONNECTION_STRING="$(cd ../terraform && terraform output -raw telemetry_connection_string)"
pip install azure-data-tables   # one-time, if not already installed
python seed_fields.py
npx -y azure-functions-core-tools@4 azure functionapp publish \
  "$(cd ../terraform && terraform output -raw function_app_name)" --python

# 4. Deploy the dashboard
cd ../dashboard
cp config.js.template config.js
#    → set apiBaseUrl to the value of: terraform output -raw api_base_url
npx -y @azure/static-web-apps-cli deploy . \
  --deployment-token "$(cd ../terraform && terraform output -raw swa_deployment_token)" \
  --env production
```

> **Cold-start:** The Function App on a Consumption plan can take a few seconds on the
> first request after a fresh deploy. If you get a timeout, just retry.

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
    "scoredAt":           "2026-10-16T12:20:00+00:00"
  }
]
```

`color` is `"green"`, `"yellow"`, or `"red"`. `score` is 0–100 (100 = highest risk).

### POST `/api/score_now` — trigger scoring immediately

Write-protected (`X-Ingest-Key` required). Runs the AI scorer for all fields right now instead of waiting for the 20-minute timer.

```bash
curl -X POST "$BASE/score_now" -H "X-Ingest-Key: $SECRET"
# → {"scored": [{"fieldId": "field-a", "color": "green", "score": 12}, ...]}
```

---

## Notes & known constraints

- **Existing resource group**: Terraform reads a pre-existing RG via a data source and never creates or destroys it. Hackathon accounts typically cannot create new RGs.
- **Key-based auth (no managed identity)**: assigning data-plane RBAC roles requires `Microsoft.Authorization/roleAssignments/write`, which hackathon accounts usually lack. Storage and OpenAI are therefore accessed via account keys stored in gitignored tfstate and app settings — never in the repo.
- **Python 3.12**: the Linux Consumption plan supports up to Python 3.12. The remote build on Azure always uses 3.12 regardless of your local Python version.
- **Azure OpenAI region**: the chosen model must be available and within TPM quota in `openai_location` (`swedencentral` by default).
- **SWA Free regions**: Static Web Apps Free tier is only available in `westus2`, `eastus2`, `centralus`, `eastasia`. `swa_location` defaults to `westus2`.
- **Cognitive account soft-delete**: after `terraform destroy`, reusing the same account name in the same region can fail for ~48 h. Use `az cognitiveservices account purge ...` or change the project name to generate a new suffix.
- **CORS**: the dashboard calls the Function App API cross-origin. The SWA hostname is allow-listed in Terraform — no manual CORS config needed.
