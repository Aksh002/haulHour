# HaulHour

> A projected HOS-aware trip planner that turns a two-leg road route into one auditable driver timeline and printable ELD-style daily logs.

**Live demo:** add the Vercel URL after deployment · **API health:** add the Render URL after deployment

HaulHour is an assessment planning demonstration, not a certified ELD and not an electronic record of actual duty activity.

## What it does

- Routes current location → pickup → drop-off through OpenRouteService's heavy-goods-vehicle profile
- Plans pickup, drop-off, fuel, 30-minute breaks, 10-hour daily rest, and 34-hour cycle restart events
- Enforces the 8-hour break, 11-hour drive, 14-hour window, and aggregate 70-hour cycle boundaries
- Projects every result from one deterministic backend event timeline
- Connects interactive route markers to a chronological itinerary and provider directions
- Builds complete home-terminal daily logs with exactly 24 hours of semantic segments
- Prints one crisp ELD-style SVG log per page and downloads the canonical plan as JSON
- Includes an explicit, deterministic 2,020-mile demo route for reliable review

## Architecture

```text
React form / results
        │
        ▼
Django REST API ──► routing provider adapter ──► OpenRouteService
        │
        ▼
TripPlanningService
        ├── RouteProgress (distance → coordinate)
        ├── pure HOS scheduler + invariant validator
        └── daily-log builder + 24-hour validator
                    │
                    ▼
          canonical TripPlan response
        map · metrics · itinerary · logs
```

The browser never recalculates schedule totals. Route geometry, stop markers, summary metrics, itinerary entries, and daily logs all retain the canonical event IDs returned by Django.

## Assumptions and limitations

- Current cycle usage is an aggregate from the previous eight days. Because individual history is not supplied, hours do not roll off during the planned trip; a 34-hour restart is inserted when needed.
- The driver begins after a qualifying 10-hour rest, so the daily clocks start fresh.
- Provider moving duration is treated as driving time. Fuel is conservatively planned at or before 900 miles.
- Logs use the selected home-terminal timezone (`America/Chicago` by default).
- Split sleeper, adverse-driving-condition extensions, live traffic, real vehicle telemetry, and historical ELD records are excluded.
- The demo fixture is clearly labelled and must not be represented as a live road route.

See [the product contract](docs/PRODUCT_SPEC.md), [decision log](docs/DECISIONS.md), and [acceptance criteria](docs/ACCEPTANCE_CRITERIA.md).

## Local setup

Prerequisites: Python 3.12+, Node 22+, and npm 10+.

```powershell
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend\requirements-dev.txt
Set-Location frontend
npm install
```

In terminal one:

```powershell
.\.venv\Scripts\python backend\manage.py runserver
```

In terminal two:

```powershell
Set-Location frontend
npm run dev
```

Open `http://localhost:5173`. “Load sample trip” works without an external key. Live address search and routing require `OPENROUTESERVICE_API_KEY` in the backend environment.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DJANGO_SETTINGS_MODULE` | `config.settings.local` locally; `config.settings.production` when hosted |
| `DJANGO_SECRET_KEY` | Required, secret production signing key |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated backend host names |
| `CORS_ALLOWED_ORIGINS` | Comma-separated exact frontend origins |
| `OPENROUTESERVICE_API_KEY` | Server-only geocoding and HGV directions key |
| `VITE_API_BASE_URL` | Public backend API base, e.g. `https://api.example.com/api` |

Never prefix the routing key with `VITE_`; Vite-prefixed values are included in browser assets.

## Checks

```powershell
.\.venv\Scripts\ruff check backend
.\.venv\Scripts\pytest
.\.venv\Scripts\python backend\manage.py spectacular --file backend\schema.yml --validate

Set-Location frontend
npm run lint
npm test
npm run build
npm run test:e2e
```

The Playwright command starts both development servers. Install its Chromium binary once with `npx playwright install chromium` if it is not already present. Coverage and boundary intent are listed in [the test matrix](docs/TEST_MATRIX.md).

## API

- `GET /api/health/` — process health
- `GET /api/ready/` — readiness without exposing secrets
- `GET /api/docs/` — interactive OpenAPI documentation
- `GET /api/locations/autocomplete/?q=...` — server-side address search
- `POST /api/locations/reverse/` — browser-location reverse geocoding
- `POST /api/trips/plan/` — complete canonical trip plan

Example request:

```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "Denver, CO",
  "dropoff_location": "Los Angeles, CA",
  "current_cycle_used_hours": 18,
  "start_at": "2026-10-05T06:00:00-05:00",
  "terminal_timezone": "America/Chicago",
  "demo_mode": true
}
```

The response includes normalized `locations`, two `route_legs`, canonical `events`, `stops`, `summary`, `daily_logs`, `assumptions`, `warnings`, and the assessment disclaimer. Validation and provider failures use a stable error envelope with a request ID.

## Deployment

`render.yaml` configures the backend and `frontend/vercel.json` configures the frontend fallback. In Render, set the host, CORS origin, and routing key. In Vercel, set `VITE_API_BASE_URL` to the deployed Render `/api` URL. Then follow the [deployment and production smoke record](docs/DEPLOYMENT.md), check print preview, and replace the URL placeholders at the top of this README.

The recording outline is in [docs/LOOM_SCRIPT.md](docs/LOOM_SCRIPT.md).
