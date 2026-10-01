# Decision Log

## Canonical backend timeline

Django owns scheduling so the map, totals, itinerary, markers, and logs cannot drift through separate frontend calculations. Domain services are deterministic and independent of HTTP.

## Aggregate cycle balance

The four required inputs do not include eight days of history. `current_cycle_used_hours` is therefore treated as an aggregate balance and no hours roll off during a trip. A 34-hour restart is inserted when unfinished driving would exceed the balance.

## No split sleeper in version one

Split-sleeper optimization significantly expands scheduler state and is not needed by the assignment. Qualifying daily resets use one consecutive 10-hour sleeper period.

## Routing provider

OpenRouteService is isolated behind a provider interface, using `driving-hgv`. The key remains server-side. A checked-in, explicitly selected demo fixture supports deterministic review and tests without fabricating a live route.

## Fuel policy

Fuel is scheduled at or before 900 route miles. This conservative fixed threshold stays below the required 1,000-mile maximum.

## Time policy

The default terminal timezone is `America/Chicago`. The visible sample starts at 06:00 on 2026-10-05. API callers should send offset-aware datetimes; an omitted start uses a configured, disclosed default rather than the server clock.

## Deployment

The target is Vercel for the Vite frontend and Render for Django. Deployment credentials and account actions remain owner tasks; production settings are environment-driven.

## Replanning from reported progress

Replanning is explicit rather than automatic. The original response remains immutable, while each replan receives a new
unguessable ID, version, and parent ID. Completed events and schedule variances are labelled driver-reported; only the
remaining suffix is projected. Request context is cached for 24 hours rather than stored as durable trip history.
