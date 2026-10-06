# HaulHour Loom Walkthrough Script

The full narrated version is approximately 7-8 minutes at a relaxed pace. For the assessment's 3-5 minute target, use the cut list immediately below. The wording is intentionally conversational, so treat it as a guide rather than reading every sentence exactly.

## Recommended 5-minute assessment cut

Keep every on-screen action, but shorten the narration as follows:

- In “Show the input experience,” stop after “precise facility entrance.”
- In “Explain the generated result,” omit the opening metric-list paragraph and begin with the canonical timeline.
- In “Show the daily logs,” omit the second paragraph after “reconciled from the same events.”
- In “Demonstrate replanning,” omit the final sentence listing IDs and metadata.
- In “Explain how it was implemented,” keep the provider adapter, scheduler, and validator paragraphs. Omit route-progress interpolation and summarize the log builder in one sentence.
- In “Engineering quality,” keep the test counts and omit the frontend dependency list.
- Use the two-sentence close, but omit the detailed limitation list if those limitations were already visible in the Assumptions tab.

That cut lands close to five minutes while still showing every major feature and the most defensible engineering decisions.

## Before recording

- Run the Django API and Vite frontend, then confirm the sample trip completes once.
- Begin on the dark-theme landing page at the top of the application.
- Keep these files ready in editor tabs: `README.md`, `hos_scheduler.py`, `trip_planner.py`, `daily_log_builder.py`, `replan_service.py`, and `TEST_MATRIX.md`.
- Use the deterministic sample trip for the main demonstration. It avoids depending on live routing during the recording and is visibly labelled as demo data.
- Do not open `.env` or expose the OpenRouteService key.
- If public deployment is not complete, say that the demonstration is running locally. Do not imply that a localhost recording is the deployed application.

## 0:00-0:35 | Introduce the problem

**On screen:** Start at the top of HaulHour. Let the cloud background and route animation run for a moment, then scroll toward the planner.

**Say:**

“This is HaulHour. It is a full-stack trip-planning application for a US property-carrying truck driver or dispatcher. The basic idea is simple: enter the driver’s current location, pickup, drop-off, and how much of the 70-hour cycle has already been used. HaulHour turns that into a road route, a projected Hours of Service timeline, and one ELD-style daily log for every day of the trip.

The wording here is deliberate. This is a planning demonstration, not a certified ELD, and it does not claim to record verified driver activity.”

## 0:35-1:15 | Show the input experience

**On screen:** Show the three location fields, Locate and Map controls, cycle-hours input, then briefly open “Trip and log options.”

**Say:**

“The four required inputs stay visually primary. Locations support US-only autocomplete, browser location, and a map picker where the pin can be clicked or dragged to a precise facility entrance. If browser location is outside the US, the app explains the regulatory boundary and offers Washington Dulles only as an explicit fallback. It never silently changes the user’s location.

The collapsed section contains optional log metadata such as the start time, terminal timezone, driver, carrier, office, vehicle, trailer, and shipping document. Those details enrich the log without making the main flow feel like a long compliance form.”

## 1:15-1:50 | Generate the sample plan

**On screen:** Click “Load sample trip,” point out Chicago, Denver, Los Angeles, and 18 cycle hours used. Click “Build trip plan.”

**Say:**

“For a reliable walkthrough I included an explicit deterministic sample route from Chicago through Denver to Los Angeles. It is about 2,020 miles and is clearly marked as demo data, so I can review the full multi-day behavior without pretending a straight line or mock response is a live truck route.

The normal path uses OpenRouteService’s heavy-goods-vehicle profile. The API key stays entirely on the Django server.”

## 1:50-2:50 | Explain the generated result

**On screen:** Let the metric cards appear. Point to route distance, wheel time, elapsed time, arrival, stops, rests, ending cycle usage, and HOS boundary badges. Open Route, click a stop marker, then show the linked itinerary item.

**Say:**

“The response starts with the operational summary: actual routed distance and moving time, projected elapsed time and arrival, fuel stops, daily rests, cycle restarts, ending cycle usage, and the number of daily logs.

The important implementation choice is that these are not separate frontend calculations. Django creates one canonical event timeline, and the metrics, map markers, itinerary, and logs are all projections of those same event IDs. That removes an entire class of bugs where the map says one thing and the log says another.

The map contains both route legs, the current location, and important operational or regulatory stops. Selecting a stop takes me to the exact itinerary event. Directions also remain available per leg, and the itinerary provides a complete non-map alternative.”

## 2:50-3:30 | Show the daily logs

**On screen:** Open “Daily logs,” switch between dates, inspect one full screen, and briefly trigger print preview if practical.

**Say:**

“Each calendar day gets a complete midnight-to-midnight ELD-style SVG sheet in the selected home-terminal timezone. Events that cross midnight are split correctly, every sheet must total exactly 1,440 minutes, and daily driving mileage is reconciled from the same events.

The SVG stays sharp when printed. It includes duty-status segments, vertical transitions, totals, driver and carrier metadata, and location-aware remarks. There is also a full-screen inspection mode, one-log-per-page print styling, and a JSON download of the canonical plan.”

## 3:30-4:35 | Demonstrate replanning from progress

**On screen:** Click “Replan from progress.” Select the pickup as the last completed event. Move the checkpoint later than its planned end, choose a duty status for the variance, enter the current US location, and submit. Show version 2, its comparison message, reported/projected labels, then “View original” and “View updated.”

**Say:**

“One extension I am especially happy with is replanning from reported progress. Instead of pretending the original projection stays accurate forever, the user can select the last completed event, report the checkpoint time and location, and regenerate only the unfinished trip.

If the driver is later than planned, the app requires a duty status for that extra time. That is not just form validation. Off duty, sleeper, driving, and on-duty time affect the 8, 11, 14, and 70-hour clocks differently.

The backend preserves the completed prefix, labels any variance as driver-reported, replays those events to reconstruct the HOS clocks, and schedules a new projected suffix. The original plan remains immutable and can still be viewed. Every replan receives a new plan ID, version, parent ID, delay comparison, and rebuilt daily logs.”

## 4:35-6:05 | Explain how it was implemented

**On screen:** Switch to the editor. Show `trip_planner.py`, `hos_scheduler.py`, `route_progress.py`, `daily_log_builder.py`, then `replan_service.py`. Do not scroll through every line; point to the relevant function boundaries.

**Say:**

“Architecturally, the React and TypeScript frontend talks to a Django REST API. Routing is isolated behind a provider adapter, so live OpenRouteService calls and deterministic demo routing share the same interface.

The scheduler is written as deterministic domain logic using integer-minute clocks. For every driving segment it calculates the nearest boundary among the 8-hour break, 11-hour driving limit, 14-hour duty window, 70-hour cycle, fuel threshold, and end of the route. It inserts the required event, updates state, and continues. A separate invariant validator then checks that the finished schedule still matches the routed miles and minutes and has not crossed a regulatory boundary.

Another useful piece is route-progress interpolation. Scheduled events know their route mileage, and that service maps the mileage back onto the provider’s real polyline. That is how rest and fuel events get meaningful coordinates instead of arbitrary points.

Finally, the daily-log builder clips the canonical events at timezone-aware midnight boundaries, fills any uncovered time as off duty, and rejects gaps, overlaps, missing transition remarks, or anything that does not total exactly 24 hours.”

## 6:05-6:45 | Engineering quality and UI details

**On screen:** Show `TEST_MATRIX.md`, the CI workflow, and briefly return to the application to toggle dark mode.

**Say:**

“I treated the regulatory boundaries as test cases rather than visual assumptions. The repository currently contains 39 backend tests, 11 frontend tests, and a Playwright reviewer journey that runs on desktop and a Pixel-sized mobile viewport. CI runs Ruff, pytest, ESLint, Prettier, component tests, the production build, and the end-to-end flow.

On the frontend I used Tailwind 4 with owned shadcn and Radix components, React Hook Form with Zod, TanStack Query, Leaflet, and Motion. The visual system has curated light and dark themes, reduced-motion behavior, a responsive route animation, and a performance-capped cloud shader. The goal was polish without letting animation interfere with the planning task.”

## 6:45-7:25 | Close honestly

**On screen:** Return to the assumptions tab or README. If deployed, show the public URL, API documentation, and health endpoint. Otherwise remain on the application.

**Say:**

“There are intentional limits. Prior eight-day history is represented as one aggregate cycle balance, split sleeper and adverse-condition extensions are not modeled, and replanning context is cached for 24 hours rather than stored as durable trip history. Live GPS tracking is documented as a future opt-in enhancement; the current map shows the projected plan, and replanning is explicitly user-triggered.

So the part I would emphasize is not just that HaulHour draws a route. It keeps routing, regulatory scheduling, explanations, map positions, and daily logs tied to one auditable model, while staying clear about what is projected and what is driver-reported. That is HaulHour.”

## Optional 45-second code deep dive

Use this only if the recording can exceed five minutes.

**On screen:** Stay in `hos_scheduler.py`, then jump to `compliance_validator.py` and the scheduler boundary tests.

**Say:**

“A subtle detail in the scheduler is that operational events also affect compliance. Pickup, drop-off, and fuel consume cycle time and advance the 14-hour window, while a qualifying non-driving period can reset the 8-hour break clock. The engine therefore cannot just split driving into eleven-hour chunks.

I kept generation and validation separate. The scheduler builds the proposed timeline, while the invariant validator independently rejects overlapping events, mismatched route totals, duplicate pickup or drop-off events, and driving past any active limit. Tests cover exact boundaries, pickup consuming the final cycle hour, midnight splitting, resumed clocks, combined daily-rest and cycle-restart cases, and corrupted schedules.”

## Short fallback ending if deployment is still pending

“Everything shown here is running locally with the deterministic review fixture. The repository includes Render and Vercel configuration plus a production smoke checklist. The remaining owner-controlled work is deploying both services, configuring the server-side routing key and CORS origin, and recording the final public URLs.”

## Claims to avoid during the recording

- Do not call HaulHour a certified ELD or say that it guarantees legal compliance.
- Do not call demo geometry a live road route.
- Do not describe reported progress as verified actual activity.
- Do not claim that replan history survives backend restarts or cache eviction.
- Do not describe the current map as live GPS tracking or navigation.
- Do not show secrets, `.env`, or a routing key in browser developer tools or the editor.
