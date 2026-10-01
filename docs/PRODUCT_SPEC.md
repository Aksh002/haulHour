# HaulHour Product Contract

HaulHour is a planning demonstration for a US property-carrying driver. A driver or dispatcher enters a current location, pickup, drop-off, and current 70-hour/8-day cycle usage. The application returns a real two-leg road route, directions, a projected HOS-aware event timeline, route stops, an itinerary, and one printable ELD-style log for every home-terminal calendar day touched.

## Required inputs

- Current, pickup, and drop-off location strings
- Optional browser detection or click-and-drag pin selection, reverse-geocoded to a US address
- Current cycle usage from 0 through 70 hours
- Optional offset-aware start time and home-terminal timezone
- Optional driver, carrier, office, tractor, trailer, and shipping-document metadata

## Required outputs

- Normalized locations and route legs through pickup in order
- Geometry, distance, moving duration, and turn instructions
- One canonical chronological event timeline
- HOS totals, stop markers, assumptions, and warnings derived from that timeline
- Complete midnight-to-midnight daily logs whose status totals equal 24 hours

## Rules implemented

- 11 driving hours after 10 consecutive hours off duty
- Driving only inside a 14-consecutive-hour window
- 30 consecutive non-driving minutes before driving beyond 8 cumulative hours
- No driving at or beyond 70 on-duty hours without a 34-hour restart
- One on-duty hour each at pickup and drop-off
- A 30-minute on-duty fuel stop at or before 900 route miles since the last fuel event

## Assessment assumptions

- Supplied cycle usage is an aggregate balance; prior daily totals are unavailable and do not roll off individually.
- The driver starts after a qualifying 10-hour rest with fresh 11-hour and 14-hour clocks.
- Route-provider duration is driving time.
- Logs use the configured home-terminal timezone, default `America/Chicago`.
- The sample trip visibly defaults to `2026-10-05 06:00 America/Chicago`; ordinary requests may supply their own start.
- Split-sleeper and adverse-driving-condition extensions are excluded.

## Non-goals

HaulHour is not a certified ELD, legal advice, a dispatch/fleet platform, an electronic record of actual duty activity, or a replacement for driver and carrier compliance review. Authentication, payments, live vehicle tracking, historical cycle reconstruction, split sleeper optimization, and adverse-condition extensions are out of scope.

Version one accepts United States locations only because its regulatory model is based on US FMCSA property-carrying rules. An overseas browser location is never silently substituted; the user may explicitly choose Washington Dulles Airport as a fallback starting point.

## User-facing disclaimer

> Projected HOS-aware plan for assessment demonstration only. HaulHour is not a certified ELD and does not create an electronic record of actual duty activity. Drivers and carriers remain responsible for verifying routes, conditions, and regulatory compliance.

## Fixed terminology

Duty statuses: `OFF_DUTY`, `SLEEPER_BERTH`, `DRIVING`, `ON_DUTY_NOT_DRIVING`.

Principal event types: `DRIVE`, `PICKUP`, `DROPOFF`, `FUEL`, `BREAK_30_MIN`, `DAILY_REST_10_HOUR`, `CYCLE_RESTART_34_HOUR`.
