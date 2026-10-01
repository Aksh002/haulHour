# Test Matrix

| Scenario | Purpose | Expected outcome | Coverage |
| --- | --- | --- | --- |
| Short same-day trip | Baseline schedule | Drive, pickup, drive, drop-off only | Backend unit |
| 8-hour boundary | Break rule | 30-minute interruption before further driving | Backend unit |
| 7.5-hour drive + pickup | Qualifying operational stop | Pickup satisfies break; no redundant stop | Backend unit |
| 11-hour boundary | Daily reset | 10-hour sleeper before further driving | Backend unit |
| 1,100 and 2,200 miles | Fuel threshold | One and two fuel stops at/before 900 miles | Parameterized unit |
| 69.5 cycle hours | Cycle exhaustion | 34-hour restart before unfinished driving | Backend unit |
| Midnight crossing | Log splitting | Complete daily sheets totaling 1,440 minutes | Backend unit |
| Route interpolation | Marker placement | Start, leg boundary, midpoint, and end coordinates | Backend unit |
| Invalid request | API envelope | Field errors inside stable error envelope | API integration |
| Demo multi-day request | Full orchestration | Route, events, stops, summary, logs, assumptions | API integration |
| Application shell | Accessible essentials | Required labelled fields and disclaimer render | Frontend component |
| Sample reviewer flow | Main browser journey | Submit, itinerary, and daily logs work on desktop/mobile | Playwright |
| Resumed HOS clocks | Existing 8/11/14/70-hour state | Required break/rest/restart is inserted before more driving | Backend unit |
| Reported rest boundaries | 30-minute, 10-hour, and 34-hour reports | Applicable HOS clocks reset and other clocks carry forward | Backend unit |
| Replan before pickup | Pickup unfinished | Remaining route includes pickup and exactly one final drop-off | API integration |
| Replan after pickup with delay | Pickup complete and variance classified | Prefix and variance are reported; one-leg suffix is projected | API integration |
| Invalid replan checkpoints | Missing event, early time, completed drop-off, expired plan | Stable actionable 400/404 errors; no schedule generated | API integration |
| Replan form validation | Positive schedule variance | Explicit duty status is required and an API error preserves the plan | Frontend component |
| Sample replan journey | Browser workflow | Replan succeeds and original remains viewable on desktop/mobile | Playwright |
| 14-hour window with on-duty interruptions | Window boundary precedes 11 driving hours | Daily rest is inserted at the exact window boundary | Backend unit |
| Pickup consumes cycle balance | Pickup reaches 70 aggregate hours | Restart occurs before subsequent driving | Backend unit |
| Long combined-boundary trip | Daily and aggregate limits both occur | Daily rest and cycle restart are both scheduled | Backend unit |
| Daily-log metadata and remarks | Supplied log identity and event location | Metadata renders and remarks include their location | Backend/frontend unit |
| SVG geometry | Midnight, noon, 24:00, rows, and transitions | Deterministic coordinates and connector count | Frontend unit |
| Automated accessibility | Initial application shell | No automatically detectable critical axe violations | Frontend unit |
| Reviewer completion flow | Print, full-screen log, replan, history, edit | All actions work with no browser console errors | Playwright desktop/mobile |

The provider adapter is designed for mocked HTTP tests and the application test suite never requires a live OpenRouteService request. A production smoke test remains required after deployment.
