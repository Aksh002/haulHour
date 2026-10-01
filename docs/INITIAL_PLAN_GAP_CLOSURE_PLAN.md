# HaulHour Initial Plan Gap-Closure Roadmap

## Implementation status

Stages 1–5 are implemented and verified locally as of 2026-10-01. Verification includes explicit OpenAPI generation,
36 backend tests, 9 frontend component/rendering/accessibility tests, frontend lint and formatting checks, the production
build, and the complete Playwright journey on desktop and mobile. Stage 6 remains owner-controlled release work.

## Purpose

Close the remaining local implementation gaps found by auditing `plan.md`. This roadmap does not add a new product
scope; it finishes the original planner contract while preserving the completed replan enhancement.

## Stage 1 — Regulatory and daily-log correctness

- Validate generated schedules with the trip's initial aggregate cycle state.
- Add the missing 14-hour, pickup-cycle-exhaustion, combined-rest/restart, and exact-boundary tests.
- Include the best available event location in daily-log remarks.
- Validate daily mileage and remark-to-segment correspondence.
- Expand daily-log tests for midnight sleeper splits and metadata.

Gate: backend lint and all scheduler, log, and API tests pass with no live provider dependency.

## Stage 2 — Input and API contract completion

- Add main-office address to the advanced trip form and TypeScript request type.
- Preserve the last submitted request when returning to edit mode.
- Map backend field errors to their matching form fields and focus the first invalid field.
- Replace generic nested OpenAPI response dictionaries with explicit response serializers where practical.

Gate: failed requests preserve values, edit mode restores the submitted request, and field errors are actionable.

## Stage 3 — Results, map, and itinerary completion

- Show ending cycle usage and cycle-restart count as first-class metrics.
- Add the current-location marker and complete marker details.
- Show event start/end times and per-day duty-status totals.
- Clearly distinguish operational, regulatory, reported, and projected events.

Gate: every original-plan result field required by the reviewer is visible and derived from the canonical response.

## Stage 4 — ELD log presentation and export

- Render driver, carrier, office, vehicle, trailer, and shipping-document metadata.
- Render location-aware remarks.
- Add an accessible full-screen log inspection mode.
- Add focused SVG coordinate, transition, metadata, and segment-coverage tests.

Gate: logs are complete on screen and in print, and rendering rules have automated coverage.

## Stage 5 — Reliability, accessibility, and evaluation coverage

- Add safe structured timing/error logs without exact addresses or secrets.
- Add an overall provider/planning timeout budget where it can be enforced safely.
- Expand component tests for loading, API errors, preserved editing, result tabs, and multi-day logs.
- Add automated accessibility checks and strengthen Playwright checks for console errors and print behavior.
- Run backend lint/tests/schema validation and frontend lint/tests/build/E2E.

Gate: all local quality gates pass on desktop and mobile with no critical accessibility findings.

## Stage 6 — Owner-controlled release work

- Deploy frontend and backend and configure production environment variables.
- Configure a shared cache if replans must survive multiple workers or restarts.
- Complete and record the production smoke matrix.
- Add public URLs, repository visibility, screenshot/preview, and final Loom link.

Gate: the original `plan.md` production definition of done is satisfied from a clean incognito browser.
