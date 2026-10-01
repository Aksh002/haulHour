# Production Deployment and Smoke Record

## Render backend

1. Create a Render Blueprint from `render.yaml`.
2. Set `DJANGO_ALLOWED_HOSTS` to the Render hostname without a scheme.
3. Set `CORS_ALLOWED_ORIGINS` to the exact HTTPS Vercel origin.
4. Set a private `OPENROUTESERVICE_API_KEY`; never expose it as a Vite variable.
5. Confirm `/api/health/`, `/api/ready/`, and `/api/docs/` return over HTTPS.

The blueprint installs dependencies, runs Django migrations, collects static files, starts Gunicorn, and configures the health path. Django production settings require a generated secret key and force HTTPS behind Render's proxy.

## Vercel frontend

1. Import the repository and use `frontend` as the project root.
2. Set `VITE_API_BASE_URL` to `https://<render-host>/api`.
3. Deploy and add the final Vercel origin to the backend CORS setting.
4. Replace the URL placeholders at the top of `README.md`.

## Production smoke record

Complete this table after both services are deployed; it cannot be truthfully checked before public URLs exist.

| Check | Expected | Status |
| --- | --- | --- |
| Incognito sample trip twice | Both 2,020-mile plans succeed | Pending deployment |
| Short live route | Geometry, instructions, events, and logs appear | Pending API key/deployment |
| Near-cycle route | 34-hour restart appears before further driving | Pending deployment |
| Invalid cycle hours | Field-level error; form values remain | Pending deployment |
| Browser console | No application errors or mixed content | Pending deployment |
| Map and autocomplete | Tiles, markers, and suggestions load | Pending deployment |
| Print preview | One complete log per page, no clipping | Pending deployment |
| API readiness | Configured status without secret disclosure | Pending deployment |
| Delayed pickup replan | Delay requires duty status; version 2 shows reported variance and a new projection | Pending deployment |
| After-pickup replan | Remaining route goes directly from the reported location to drop-off | Pending deployment |
| Replan cache expiry | An unavailable plan returns `PLAN_NOT_FOUND` with guidance to create a new plan | Pending deployment |

Record the deployed URLs, date, browser, and any findings here before submission.

Replan state uses the configured Django cache with a 24-hour TTL. The default local in-memory cache is intentionally
non-persistent. A production deployment that needs replan context to survive process restarts or multiple workers must
configure a shared cache such as Redis; this application does not claim persistent trip history.
