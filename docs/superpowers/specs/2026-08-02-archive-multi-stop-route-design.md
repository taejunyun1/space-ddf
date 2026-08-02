# Archive multi-stop route design

## Goal

Improve the regional archive on mobile and extend the route planner from one destination to an ordered multi-stop itinerary without adding Google Maps JavaScript, Directions, or Routes API requests.

## Scope

- Remove the mobile archive list's viewport-height constraint and nested list scrolling.
- Allow users to select multiple ongoing exhibitions in a deliberate visit order.
- Preserve the ordered selection in the route URL.
- Allow reordering, removing, and clearing selected stops.
- Open the resulting itinerary in Google Maps in a new tab.
- Increase the primary route action's visual contrast and clarify how many venues it opens.

The existing archive keeps all records in list view, while map and route-planner candidates remain limited to ongoing exhibitions.

## Mobile archive list

The mobile list view becomes normal document flow. The archive pane and list content do not use `100dvh`, calculated viewport heights, or a nested vertical scroller. The browser page scrolls through the complete filtered record list. Map view retains its bounded map height because it is a separate mobile tab.

## Ordered selection model

The route planner stores an ordered array of exhibition IDs. Selecting an unselected exhibition appends it to the end. Selecting an already selected exhibition removes it and closes the numbering gap. Search and city filters affect only visible candidates and never discard the itinerary.

Each selected candidate shows its one-based visit number. Selection state is exposed through `aria-pressed` and a visible, non-color-only order marker.

The URL stores the ordered IDs as one comma-separated `to` query value, normalized into an ordered array. Exhibition IDs may not contain commas. Invalid, duplicate, non-ongoing, and missing IDs are removed. The canonical normalized selection is written back with `router.replace`, so reload, back/forward navigation, and shared links retain the itinerary without adding history entries for every click.

## Route controls

The controls display a compact ordered path:

1. Selected origin.
2. Intermediate exhibitions labelled as waypoints.
3. The final selected exhibition labelled as destination.

Every exhibition row provides move-up, move-down, and remove controls. Move controls are disabled at their respective bounds. A clear-all action appears when at least two exhibitions are selected. On mobile, these controls remain inside the existing collapsible bottom sheet.

## Google Maps URL contract

The first selected exhibition is the destination when only one is selected. With multiple selections, the last exhibition is the destination and all earlier exhibitions are sent as ordered `waypoints`. Current-location origin continues to omit the `origin` parameter; fixed Biennale and ACC origins continue to include it. The selected travel mode is preserved.

Google Maps opens through a normal HTTPS link in a new tab with `noopener noreferrer`. No embedded map or billable Google Maps client API is added.

## Primary action design

The route action is a full-width, high-contrast black button with white text, a directional SVG icon, and a minimum 48px touch target. Its copy communicates state:

- No selection: help text only; no inactive link.
- One selection: `1곳 길찾기 열기`.
- Multiple selections: `<count>곳 경로 열기`.

The action retains the existing DDF square-cornered, rule-based visual system. A selected-card order badge is the single stronger visual signature; no unrelated typography or palette changes are introduced.

## Error and limit behavior

Invalid URL selections are ignored safely. If no valid ongoing exhibition remains, the route action is unavailable and the interface asks the user to select a destination. Google Maps URL generation returns an empty value for an empty itinerary.

The initial release does not auto-optimize stops and does not call a routing API. Visit order always remains under user control.

## Testing and QA

Automated tests cover:

- Ordered Google Maps waypoint and destination parameters.
- Current-location and fixed-origin behavior.
- Duplicate and invalid query normalization.
- Append, remove, reorder, and clear semantics.
- Mobile archive list removal of viewport-height and nested-scroll constraints.
- Selected order markers, accessible pressed state, and readable route-action copy.
- Continued absence of Google Maps client API dependencies.

Manual QA covers desktop and 390px mobile layouts, full-page archive scrolling, bottom-sheet controls, route reordering, reload persistence, new-tab Google Maps output, keyboard focus, and production smoke checks.
