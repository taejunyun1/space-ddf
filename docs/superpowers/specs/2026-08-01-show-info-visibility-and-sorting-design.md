# Show Information Visibility and Sorting Design

## Goal

Complete the published `멸망 언박싱` information, hide empty information rows on public detail pages, and keep the Show list ordered from newest to oldest by the exhibition's actual start date.

## Published exhibition data

- Keep the existing `Artists` entries for 김현석, 신혜란, 정이든, 한지혜, 정한결 and the existing `Curating` entry for 신수와.
- Add `Graphic` with value `정한결`.
- Add `Support` with value `전남광주통합특별시, 광주문화재단`.
- Add `Archive` with value `정한결`.
- Do not add empty `Critic` or `Directing` records.
- Update both `content_credits` and the active published payload so the public page changes immediately without requiring a separate admin republish.

## Detail-page visibility

- Preserve the standard display order: `Artists`, `Curating`, `Critic`, `Graphic`, `Support`, `Archive`, `Directing`.
- Render only groups that contain at least one non-empty entry.
- Continue rendering custom groups after standard groups when they contain entries.
- Keep all seven fixed inputs in `/admin`, because an absent public value must remain editable later.
- Preserve the existing Instagram SVG link treatment and accessible link labels.

## Show ordering

- Sort the Show main list newest-to-oldest using `startDate` when the managed-content API supplies it.
- Fall back to the display `dateRange` for static and legacy content.
- Accept ISO dates (`YYYY-MM-DD`) and dot-formatted dates with an optional final period (`YYYY.MM.DD.`).
- Continue using end date and title as deterministic tie-breakers.
- Items without a valid date remain below dated items.

## QA and deployment

- Add focused tests for trailing-period parsing, `startDate` priority, descending Show ordering, and empty-group filtering.
- Run lint, the full test suite, and the Cloudflare Pages build.
- Verify the public Show list starts with `멸망 언박싱`, the detail page shows only populated information labels, and all five artist Instagram icons remain accessible.
- Verify `/admin` still exposes all seven standard information fields.
- Deploy to the production Pages branch and run the production smoke suite.
