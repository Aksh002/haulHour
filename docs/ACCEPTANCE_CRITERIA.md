# Acceptance Criteria

## Product and routing

- Required fields validate with field-level errors; cycle usage accepts 0–70 inclusive.
- The route contains current → pickup and pickup → drop-off legs with non-empty geometry, distance, duration, and directions.
- Live provider failures use stable error codes; demo data is explicitly labelled.
- Provider secrets never enter browser assets, API responses, or logs.

## Scheduling

- One canonical event sequence supplies every downstream view.
- Pickup and drop-off occur once, in order, and each lasts exactly 60 on-duty minutes.
- Fuel occurs before route distance since fuel exceeds 1,000 miles.
- No driving continues beyond the 8-hour break, 11-hour driving, 14-hour window, or 70-hour cycle boundaries.
- Required 30-minute breaks, 10-hour sleeper periods, and 34-hour restarts explain their reason.
- Identical inputs produce identical schedules; invariants reject corrupted schedules.

## Daily logs

- Events split in the home-terminal timezone at midnight.
- Each day covers minutes 0–1440 exactly once with no overlap or gap.
- Daily status totals equal 1,440 minutes and driving mileage reconciles to the trip total.
- SVG logs show horizontal status segments and vertical transitions and print one complete day per page.

## Experience and accessibility

- The form works by keyboard at 360, 768, 1024, and 1440 pixel widths without horizontal page overflow.
- A sample multi-day plan can be loaded and submitted quickly.
- Summary, map, itinerary, directions, assumptions, and logs remain internally consistent.
- Failures preserve inputs and provide an actionable retry path; the itinerary remains a map alternative.
- Visible focus, semantic controls, sufficient contrast, and reduced-motion behavior are present.

## Engineering and submission

- Health/readiness endpoints, OpenAPI documentation, safe production settings, and request IDs exist.
- Backend lint/tests and frontend lint/tests/build pass in CI and from documented local commands.
- Production is HTTPS, debug-free, and smoke-tested for short, multi-day, near-cycle, and invalid inputs.
- The public repository has no secrets or generated junk and leads reviewers to the live demo.
- A 3–5 minute walkthrough shows the deployed flow, code architecture, tests, assumptions, and limitations.
- Every screen and document describes an assessment planning demo, never a certified ELD.
