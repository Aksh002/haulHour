# HaulHour Foreground Live Position Upgrade Plan

## 1. Purpose

Add an optional, foreground-only live-position overlay to an already generated HaulHour trip plan. While the application is open, a driver may choose to display their current GPS position, see approximate progress along the planned road geometry, and receive a cautious off-route indication.

This is a visual planning aid. It is not turn-by-turn navigation, fleet tracking, an actual ELD record, or a source of automatic HOS rescheduling.

## 2. Product boundaries

### Included

- Explicit “Follow my location” opt-in after a trip plan has been generated
- Browser `navigator.geolocation.watchPosition()` integration
- Live-position marker and GPS accuracy radius
- Last-updated time and accuracy status
- Optional map-camera following with a manual recenter action
- Approximate route progress based on the nearest point on canonical route geometry
- Accuracy-aware, debounced off-route warning
- Clear permission, unsupported-browser, stale-position, and out-of-US messages
- Immediate stop and cleanup when disabled or when the component unmounts

### Excluded

- Background tracking after the browser suspends or closes the page
- Location-history storage, analytics, or transmission to a fleet service
- Automatic rerouting or traffic-aware navigation
- Voice or maneuver-by-maneuver guidance
- Automatic changes to schedule events, fuel stops, HOS clocks, daily logs, or projected arrival
- Treating observed movement as an electronic record of actual duty status
- Dispatcher monitoring, driver accounts, or multi-vehicle tracking

If any excluded capability becomes required, it must be specified as a separate product phase rather than silently added to this feature.

## 3. Architectural rule

The Django response remains the immutable canonical **projected plan**. Live GPS state is temporary browser state and may only annotate that plan.

```text
Canonical TripPlan response ──► route, events, logs, planned totals
             │
             └──► route geometry ──► nearest-point projection
                                          ▲
Browser watchPosition ──► ephemeral GPS fix ┘
             │
             └──► live marker, accuracy, progress, off-route warning
```

No GPS fix is sent to the planning endpoint. The frontend must not mutate the canonical response or reuse live coordinates as actual ELD data.

## 4. Domain and UI state

Create typed frontend models:

```ts
type LiveLocationState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'tracking'; fix: LivePositionFix }
  | { status: 'stale'; fix: LivePositionFix }
  | { status: 'denied'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string }

interface LivePositionFix {
  latitude: number
  longitude: number
  accuracyMeters: number
  headingDegrees: number | null
  speedMetersPerSecond: number | null
  capturedAt: number
}
```

Route projection should return:

- Nearest route coordinate
- Absolute route miles completed
- Approximate route miles remaining
- Cross-track distance from the route
- Route-leg ID and fraction
- Whether the result is reliable given reported GPS accuracy

## 5. Stage-by-stage implementation

### Stage 0 — Feature contract and privacy language

1. Add the included and excluded behaviors above to the product documentation.
2. Define “live position” and “projected plan” as visibly different concepts.
3. State that browser tracking may stop when the tab is backgrounded or the phone is locked.
4. Confirm that no live coordinate is stored or sent to the HaulHour backend.
5. Keep the existing US-only regulatory boundary.

Acceptance gate:

- No copy implies continuous background tracking, navigation, or actual ELD recording.
- The user must explicitly start tracking.
- Privacy behavior is understandable before permission is requested.

### Stage 1 — Geolocation lifecycle hook

Create a `useLivePosition` hook that:

1. Checks browser capability before requesting permission.
2. Calls `watchPosition`, never repeated `getCurrentPosition` polling.
3. Uses documented options such as high accuracy, a bounded timeout, and a short maximum age.
4. Normalizes each fix into `LivePositionFix`.
5. Retains only the latest fix in memory.
6. Calls `clearWatch` when stopped and during unmount cleanup.
7. Ignores callbacks from a stopped or superseded watch.
8. Marks a fix stale after a configurable period, initially 30 seconds.
9. Maps browser error codes to clear user-facing messages.

Acceptance gate:

- Starting creates at most one active watcher.
- Stopping and unmounting always clear it.
- Denial and unavailable-location errors never erase the trip plan.
- No frontend network request contains the live coordinates.

### Stage 2 — Pure route projection utility

Build a deterministic frontend utility independent of React and browser APIs:

1. Traverse both canonical route legs as one ordered polyline while preserving leg identity.
2. Project a GPS coordinate onto every candidate segment and choose the nearest valid point.
3. Return cumulative route progress and cross-track distance.
4. Clamp progress to route start/end and preserve the pickup boundary.
5. Treat a projection as low confidence when GPS accuracy is too broad to distinguish the route.
6. Never replace route-provider geometry with a straight line.

Required tests:

- Origin, pickup boundary, and destination
- Exact route vertex and between-vertex projection
- Position before the route and beyond the destination
- Equidistant segment choice remains deterministic
- Accuracy radius larger than cross-track distance
- Both route legs retain correct progress ordering

Acceptance gate:

- Identical geometry and fix always return identical progress.
- Reported progress never decreases because leg geometries were concatenated incorrectly.
- Utility has no map, React, network, or geolocation dependency.

### Stage 3 — Live map overlay

Add these elements to the existing route map:

1. “Follow my location” toggle, initially off.
2. Distinct live-position marker not reused for origin, stop, or event markers.
3. Accuracy circle sized from `accuracyMeters`.
4. Small status panel showing accuracy and “updated N seconds ago.”
5. Follow-camera mode that pans only while enabled.
6. A recenter button when the user manually pans away.
7. Textual live-position status outside the map for non-map access.
8. Do not fit the entire route again after every GPS update.

Acceptance gate:

- Planned origin and live position cannot be mistaken for each other.
- Manual map inspection is not continually overridden by incoming fixes.
- The feature works at mobile and desktop widths.
- Map failure does not hide permission/error status.

### Stage 4 — Progress and off-route indication

Display only cautious observational values:

- “Approximately X route miles completed”
- “Approximately Y route miles remaining”
- “Near planned route” or “Possibly off planned route”

Off-route behavior:

1. Use an accuracy-aware threshold, never a single raw distance comparison.
2. Start with a configurable minimum threshold around 0.5 miles.
3. Require multiple consecutive reliable fixes outside the threshold before warning.
4. Require multiple reliable fixes back near the route before clearing the warning.
5. Suppress the warning when reported accuracy is too poor.
6. Never automatically request a new route or alter the planned timeline.

Acceptance gate:

- GPS jitter does not rapidly toggle the warning.
- Poor-accuracy fixes are labelled uncertain rather than off-route.
- Route progress is explicitly approximate.
- Summary totals, events, and logs remain byte-for-byte unchanged.

### Stage 5 — US boundary and fallback behavior

1. Reverse-check the first reliable live fix using the existing US-aware backend endpoint only when needed for boundary validation.
2. If outside the United States, stop tracking and explain that this version models US FMCSA rules.
3. Do not replace a live position with Washington Dulles or any other location.
4. The existing Washington Dulles option remains available only as an explicit planning-input fallback.
5. Avoid repeatedly reverse-geocoding every GPS update; cache the boundary result conservatively.

Acceptance gate:

- Overseas coordinates never appear as a supported live trip position.
- No fallback location is selected without a user action.
- Boundary checks are bounded and do not create an API request per GPS fix.

### Stage 6 — Accessibility, privacy, and reliability

1. Make start/stop controls keyboard accessible with visible state text.
2. Announce permission failures and off-route transitions through an appropriate live region without announcing every GPS fix.
3. Show why HTTPS and location permission are required.
4. Respect reduced-motion preferences when moving the marker or camera.
5. Stop tracking when the user edits or replaces the active trip plan.
6. Do not log exact coordinates in production console or telemetry.
7. Add a compact privacy disclosure beside the tracking control.

Acceptance gate:

- Tracking can be started, understood, and stopped without using the map.
- No exact coordinate is persisted in local storage, session storage, IndexedDB, cookies, or backend logs.
- Permission denial has a clear recovery path through manual locations.

### Stage 7 — Automated and manual verification

Unit tests:

- Hook lifecycle, stale timer, permission states, and cleanup
- Route projection and off-route hysteresis
- Canonical plan object remains unchanged

Component tests:

- Idle, requesting, tracking, stale, denied, and error panels
- Start/stop control and privacy disclosure
- Accuracy and progress formatting

Playwright tests using mocked browser geolocation:

- Grant permission and move through multiple route positions
- Deny permission without losing results
- Simulate off-route fixes and recovery
- Verify mobile and desktop presentation
- Verify plan events and log values do not change after live updates

Manual checks:

- Chrome/Edge desktop and Android Chrome
- HTTPS-hosted build
- Background/foreground browser behavior is honestly communicated
- Low-accuracy indoor fix
- Permission revoked while tracking

Acceptance gate:

- All existing backend/frontend/end-to-end tests still pass.
- New location tests pass without calling a real GPS device.
- No critical accessibility violation is introduced.

### Stage 8 — Documentation and release

1. Update README features and limitations.
2. Add screenshots or walkthrough coverage of opt-in tracking.
3. Explain that progress is approximate and does not update HOS projections.
4. Add live-position checks to the production smoke record.
5. Update the Loom script only after production verification.

Acceptance gate:

- Reviewers can distinguish planned data from live observational data immediately.
- Documentation never describes this as continuous background tracking or navigation.

## 6. Recommended implementation order

1. Contract and privacy copy
2. Pure route projection utility and tests
3. Geolocation lifecycle hook and tests
4. Map marker, accuracy circle, and status panel
5. Progress and off-route hysteresis
6. US boundary behavior
7. Accessibility and browser tests
8. Production verification and documentation

Do not start automatic rerouting or HOS rescheduling as part of this upgrade.

## 7. Definition of done

The upgrade is complete when a user with an existing trip plan can explicitly start foreground location tracking, see a clearly differentiated live marker and accuracy radius, inspect approximate progress, receive a stable accuracy-aware off-route warning, and stop tracking at any time. The canonical projected route, events, summaries, and ELD-style logs must remain unchanged, exact coordinates must not be persisted, overseas positions must be rejected transparently, and desktop/mobile automated tests must pass.

## 8. Future phase requiring separate approval

A Google Maps-style navigation product would require a new specification covering automatic rerouting, traffic, dynamic ETA, map matching, background/native location, voice guidance, telemetry retention, privacy and consent, driver identity, and the regulatory meaning of revising projected HOS events during an active trip. That work is deliberately outside this upgrade.
