# HaulHour Replan From Reported Progress Upgrade Plan

## Implementation status

Stages 0–6 are implemented and verified locally as of 2026-09-30. Stage 7 documentation is complete; its production
smoke gate remains pending until the owner deploys the frontend/backend and records the public URLs. Local verification
includes backend unit/API tests, frontend lint/component/build checks, OpenAPI validation, and the desktop/mobile
Playwright replan journey.

## 1. Purpose

Allow a user to create a new projected plan from a manually reported trip checkpoint without continuous GPS tracking. The original plan remains intact. A replan preserves a completed event prefix, records any reported delay with an explicit duty status, reroutes from the reported US location, carries forward the HOS clocks, and schedules only the unfinished trip.

This feature remains a planning demonstration. Reported progress is user-supplied information, not certified ELD data or an electronic record of actual duty activity.

## 2. Version-one boundaries

Included:

- Explicit “Replan from progress” action
- Original plan ID and immutable original response
- Last completed event selection
- Reported completion/checkpoint time
- Current US location
- Required duty status for positive delay after the selected event
- Recalculated HOS state at the checkpoint
- Remaining route through any unfinished pickup and drop-off
- New versioned canonical timeline
- Planned-versus-reported delay
- Clear source labels: reported completed, reported variance, projected

Excluded:

- Continuous GPS or background tracking
- Importing ELD records
- Editing every historical event
- Certifying reported information
- Replanning from a checkpoint earlier than the selected event's planned end in version one
- Automatic rerouting without a user submission
- Persistent trip history or multi-user dispatch workflows

## 3. Core correctness rule

Current location and completion time alone do not determine HOS availability. Every positive variance must have an explicit duty status because on-duty, off-duty, sleeper, and driving time affect regulatory clocks differently.

The replan pipeline is:

```text
Original cached plan + request context
              │
              ▼
Validate completed prefix and checkpoint
              │
              ├── append explicitly classified reported variance
              ├── replay prefix to derive HOS clock state
              ├── geocode current US location
              ├── route to unfinished pickup/drop-off
              └── schedule projected suffix from derived state
                              │
                              ▼
                    Versioned canonical plan
```

## 4. Stage-by-stage implementation

### Stage 0 — Contract and terminology

- Use “reported progress,” never “verified actual log.”
- Preserve the original plan under its own ID.
- Give every replan a new ID, version, parent plan ID, checkpoint, delay, and assumptions.
- Mark events as `REPORTED_COMPLETE`, `REPORTED_VARIANCE`, or `PROJECTED`.

Gate: no response or screen can confuse user-reported history with certified duty records.

### Stage 1 — Plan context and API contract

- Store each generated plan and normalized request context in the configured backend cache for 24 hours.
- Use unguessable plan IDs.
- Add `POST /api/trips/replan/` with plan ID, last completed event ID, checkpoint time, current location, and delay duty status.
- Return stable errors for missing/expired plans, invalid event IDs, completed drop-off, early checkpoints, and unsupported locations.

Gate: invalid checkpoints cannot reach routing or scheduling; expired context has an actionable error.

### Stage 2 — HOS state replay

- Replay the completed prefix from the original aggregate cycle value.
- Carry driving since break, driving since daily rest, elapsed 14-hour window, cycle usage, and miles since fuel.
- Apply qualifying 30-minute interruptions, 10-hour rests, and 34-hour restarts.
- Treat the reported variance according to its selected duty status.
- Extend the scheduler to accept a validated initial HOS state without changing normal fresh-trip behavior.

Gate: boundary tests at 8, 11, 14, and 70 hours pass from both fresh and resumed states.

### Stage 3 — Remaining routing and canonical replan

- If pickup is unfinished, route current → pickup → drop-off.
- If pickup is completed, route current → drop-off.
- Reject replanning after completed drop-off.
- Preserve the completed prefix, append reported variance, and generate the projected suffix.
- Rebuild daily logs from the combined versioned timeline.
- Run schedule/log validators on the projected suffix and combined chronological timeline.

Gate: pickup/drop-off are completed exactly once across prefix and suffix and no combined events overlap.

### Stage 4 — Replan interface

- Add “Replan from progress” beside existing result actions.
- Present completed-event selection, checkpoint time, current US location, and variance duty status.
- Explain why duty status is required.
- Preserve the active plan if submission fails.
- Show parent plan, version, delay, and event-source distinction in the result.
- Keep the original plan available in the current browser session.

Gate: the flow is keyboard accessible and never destroys the original result.

### Stage 5 — Comparison and explanation

- Show reported delay against the selected event's planned end.
- Explain changed route distance, projected arrival, rests, and restarts.
- Do not claim causality beyond known inputs.
- Keep reported and projected log segments visibly distinct while retaining the assessment disclaimer.

Gate: reviewers can identify what was reported, what changed, and what remains projected in one interaction.

### Stage 6 — Reliability and tests

- Unit-test state replay, variance classification, reset boundaries, and resumed scheduler invariants.
- API-test before-pickup, after-pickup, exhausted-cycle, expired-plan, invalid-event, and completed-drop-off cases.
- Component-test validation and error preservation.
- Playwright-test a sample plan followed by a replan on desktop and mobile.
- Confirm no provider key or reported location is logged.

Gate: all existing tests and new replan tests pass; original plan JSON remains unchanged.

### Stage 7 — Documentation and deployment verification

- Document the 24-hour cache limitation and non-persistent nature of replans.
- Add production smoke cases for a delayed pickup and an after-pickup replan.
- Update walkthrough language to call completed data “driver-reported.”

Gate: production behavior and documentation make no persistence or ELD-certification claim.

## 5. Definition of done

A user can take an existing plan, select the last completed event, report a checkpoint at or after that event, explicitly classify any delay, enter a current US location, and receive a new versioned projected plan for only the unfinished trip. The original plan remains available, carried HOS clocks satisfy scheduler invariants, combined daily logs remain complete, and all reported versus projected information is visibly distinguished.
