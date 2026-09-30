# VibeTravel UAT Feedback Tracker

Last updated: 2026-09-30

## Test execution

| Test case | Status | Notes |
|---|---|---|
| VT-001 | Completed | No blocking issue reported. |
| VT-002 | Completed | No blocking issue reported. |
| VT-003 | Completed with findings | Personalization rationale needs to be more visible; neighborhood and walkable-area discovery is missing. |
| VT-004 | Completed | No blocking issue reported. |
| VT-005 | Completed with findings | Activity density and family pace are not visibly connected; generated plans lack neighborhood exploration and concise per-stop personalization rationale. |
| VT-006 | Completed | No blocking issue reported. |
| VT-007 | Passed with concerns | Estimates, Directions, and route behavior passed. Concerns remain around excessive activity density for a moderate pace and the lack of rideshare or mixed-mode travel. |
| VT-008 | Passed | A different signed-in account received a generic 404 for the owner's trip URL, no private data was exposed, and the owner retained normal access with the test confirmation code intact. |
| VT-009 | Passed with UX note | The signed-out shared view was accurate and read-only, private readiness data remained hidden, and revocation blocked the link. Owners need clearer notice that itinerary stop notes are included. |
| VT-010 | Passed | Booking statuses, private details, checklist data, budget calculations, persistence, and Departure Center updates all worked correctly. |
| VT-011 | Passed | Countdown, readiness percentage, outstanding counts, drawer access, live updates, and persistence all worked correctly. |
| VT-012 | Passed | The offline HTML downloaded, contained the complete itinerary, excluded private readiness data, opened without internet, and restored Maps links after reconnecting. |
| VT-013 | Failed with partial functionality | Manual restaurant searches displayed a relevant “Why this fits” explanation, confirming reactive personalization works. However, Foodie Family did not influence Explore defaults or trip-creation suggestions, so proactive personalization failed. |
| VT-014 | Passed | Trip Mode correctly presented the next stop, opened directions, shifted later stops, advanced after complete/skip actions, and persisted changes. |
| VT-015 | Passed with concerns | Core mobile navigation and interactions worked. The desktop articles rail has no mobile entry point, and overall mobile latency was reported as very poor. |
| VT-016 | Passed with UX concern | Data was preserved, loading recovered, retry succeeded, and no duplicates were created. The displayed “Failed to fetch” message did not explain that connectivity was the cause or that the change had not been saved. |
| VT-017 | Blocked | The test trip could not generate its initial itinerary. Browser diagnostics confirmed repeated HTTP 504 responses from the itinerary endpoint, preventing the cross-session consistency test from being completed. This is a prerequisite failure, not a VT-017 verdict. |
| VT-018 | Passed | Public, signed-in, empty, loading, shared, and error-state polish behaved as expected. |
| VT-019 | Passed | A trip beginning in four days correctly showed the Final checks phase, an accurate countdown, readiness progress, and outstanding booking/task counts. |
| VT-020 | Passed | Full rebuilding displayed the replacement warning and cancel preserved all edits. Refreshing an unstarted target day visibly rebuilt that day while leaving the unrelated day and its manual note unchanged. Completed and skipped stops were also correctly protected during the initial check. |
| VT-021 | Passed with UX concern | Deleting an itinerary stop correctly removed its booking, cost, confirmation, and readiness contribution after reload. The readiness view remained stale during the current session and required a full page refresh before reflecting the deletion. |
| VT-022 | Passed | An active shared link reflected the owner’s latest itinerary update, revocation disabled the original URL, and a newly created link used a different URL while the revoked link remained unavailable. |
| VT-023 | Passed | The offline trip pack produced a clean print/PDF preview without visible controls, clipping, broken day sections, or unreadable output. |
| VT-024 | Passed with separate defect | Rapid clicks did not create duplicate saved places, updates, or share links. During testing, a separate confirmed defect showed that Refresh day cannot incorporate a newly saved day-assigned attraction because targeted refresh does not receive saved-attraction data; only a full rebuild applies it. |
| VT-025 | Passed | Core navigation, dialogs, readiness controls, focus states, labels, keyboard dismissal, contrast, and 200% zoom behavior remained usable without clipping or required horizontal scrolling. |

## Findings backlog

| Finding | Priority | Related tests | Status | User feedback and expected outcome |
|---|---|---|---|---|
| UAT-001 | P0 | VT-007 | Passed | Mode-specific estimates, Directions, and route behavior passed during formal VT-007 testing. |
| UAT-002 | P1 | VT-005, VT-007, VT-013 | Open | Family pace and preferred activity density should materially influence itinerary generation. With only three user-selected places and a Moderate family pace, the generated day contained six locations and about eight hours of events, including restaurants. A moderate itinerary should cap or clearly justify activity density, add meaningful downtime, and distinguish user picks from optional additions. |
| UAT-003 | P1 | VT-003, VT-005, VT-007 | Open | Search and itinerary generation return named destinations but not neighborhood or walkable-area exploration. Results should include appropriate area-based blocks such as exploring Akihabara, with nearby family-fit stops clustered together. |
| UAT-004 | P1 | VT-003, VT-005, VT-013 | Open | The product's differentiator—why a result matches the family vibe—is buried in long prose. Search results and itinerary stops should have short, scannable rationale such as “Matches: technology interest · ages 8–12 · high-energy day.” |
| UAT-005 | P1 | Family profile | Open | The family profile is child-centric. It should support a spouse or partner, additional adults, grandparents, and extended-family travelers so recommendations reflect the whole group. |
| UAT-006 | P1 | VT-007 | Open | Travel mode offers Walk, Transit, and Drive, but not rideshare. Add a city-appropriate Rideshare option for places such as New York where a traveler may use Uber or Lyft without renting a car. |
| UAT-007 | P1 | VT-007 | Open | A single travel mode applies to the entire itinerary, while real city trips are multimodal. Support an Auto or Mixed mode that recommends the best mode per segment—for example walk to one stop, take a train across town, and use rideshare late at night or with tired children. |
| UAT-008 | P2 | VT-008 | UX note | The generic 404 is security-correct because it does not reveal whether another user's trip exists. A branded “Trip unavailable” state could make the experience feel more intentional while preserving the same privacy behavior. |
| UAT-009 | P2 | VT-009 | Open | Add an explicit tooltip or disclosure beside the share control explaining that itinerary stop notes are visible to anyone with the private link, while readiness details, costs, booking links, and confirmation codes remain private. |
| UAT-010 | P0 | VT-013 | Passed production retest | Personalization is reactive rather than proactive. Selecting Foodie Family should immediately reshape Explore defaults and trip-creation suggestions toward restaurants, markets, food tours, cooking experiences, and neighborhood food exploration. Users should not need to repeat “restaurants” in the search box for the saved vibe to matter. The default provider query and suggestion chips now derive from the saved travel style and dietary preferences. |
| UAT-011 | P1 | VT-015 | Next build | The articles sidebar is intentionally hidden below the desktop breakpoint, but mobile users have no alternative entry point. Add a compact “Travel reads” card, drawer, or tab rather than rendering the full desktop rail. |
| UAT-012 | P0 | VT-015 | Implemented — real-device retest | Mobile latency was traced to three avoidable costs: a fresh AI summary request on every trip-page load, the full Scout AI/chat bundle and history request loading before Scout opened, and the optional desktop vlog request running on mobile. Trip summaries now render locally, Scout and its 408 KB AI chunk load on demand, mobile skips the vlog request, route transitions show an immediate skeleton, and noncritical images decode lazily. Retest on a real phone before closing. |
| UAT-013 | P1 | Notifications | Next build | There is no traveler-facing notification system. Add opt-in in-app and/or push reminders for unresolved bookings, incomplete departure tasks, and upcoming departure milestones, with clear preference controls and no notification spam. |
| UAT-014 | P1 | VT-016 | Implemented — retest | Raw browser network failures are now translated into connection-aware language for search, itinerary, readiness, day planning, trip creation, sharing, and vibe-profile actions. Save failures explicitly state that the change was not saved; search/load failures provide reconnect-and-retry guidance. |
| UAT-015 | P0 | VT-017 prerequisite | Passed production retest | Initial itinerary generation repeatedly returned HTTP 504 for trip `870d225d-d2f1-441d-9288-bf91f9355405`. Long trips now generate in independently saved sections of up to 14 selected days, with a seven-day default, so users can continue planning without replacing completed sections or exceeding the request ceiling. |
| UAT-016 | P2 | Content enrichment | Open | `/api/vlogs?destination=Sydney%2C%20Australia` returned HTTP 500 during the same session. This is separate from itinerary generation and should fail gracefully by hiding the optional vlog strip or showing a non-blocking fallback. |
| UAT-017 | P1 | VT-021 | Passed production retest | Itinerary deletion and readiness storage reconcile correctly, but the readiness UI previously retained the old itinerary until the page was refreshed. Saved itinerary changes now update Trip Readiness, the Departure Center, and offline-pack data immediately in the current session. |
| UAT-018 | P1 | VT-006, VT-024 | Refresh retest passed; direct action open | Targeted Refresh day now receives every saved place assigned to that date and deterministically adds any assigned place omitted by the planner, without replacing unrelated days. Existing itineraries still need a clearer direct Add stop action. |
| UAT-019 | P1 | Long-trip production retest | Implemented — retest | The Leaflet trip map rendered above the long-trip planner dialog and its dark overlay, obscuring the date list and modal actions. The map now establishes an isolated page-level stacking context so Leaflet's internal panes remain below every dialog and overlay. |

## VT-007 test directions

Record these three observations:

1. **Map:** Does the Trip Map show pins, remain on “Locating attractions…”, or show “Could not locate attractions on map”?
2. **Directions:** Does the Directions link between two stops open Google Maps with the correct origin, destination, and selected travel mode?
3. **Optimization:** Is Optimize route enabled, and if clicked, does it reorder stops and update their times?

Do not record a pass or fail until all three checks have been completed.
