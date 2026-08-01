# Project and Show Metadata Normalization Design

## Goal

Make every published Project and Show follow one structured information format, while ensuring the same format can be entered, edited, saved, published, and reopened through `/admin` without losing legacy information.

## Canonical public format

- Use the same detail-page component and metadata rules for both `show` and `project` content.
- Keep the existing poster, date, location, introduction, body, and gallery layout.
- Render populated standard credit groups in this fixed order: `Artists`, `Curating`, `Critic`, `Graphic`, `Support`, `Archive`, `Directing`.
- Hide missing dates, locations, credit groups, and other optional information rather than rendering empty labels.
- Group repeated contributors under one visible label.
- Render Instagram destinations as accessible SVG icon links beside the contributor name; never expose raw Instagram URLs as visible text.
- Render populated custom metadata after the standard credit groups.

## Admin upload and editing format

- Keep a single `/admin` content workflow with an explicit `Show` or `Project` type selector.
- Provide fields for title, slug, start date, end date, display date, location, all seven standard credit groups, custom information, introduction, body, poster, preview image, and gallery images.
- Keep each credit group repeatable so contributors can be stored as separate name/link records.
- Give each contributor row an optional URL field so Instagram links round-trip as structured links.
- Preserve composition-safe input handling so Korean IME text is not truncated or split during autosave.
- Empty virtual rows are editor affordances only. They must not be persisted or counted as valid publish metadata.
- Reopening a saved draft or published item must restore the same type, dates, location, credits, custom information, URLs, text, and image roles.

## Canonicalization and legacy compatibility

- Normalize existing Korean and English aliases to the seven canonical standard labels at the API boundary.
- Preserve `Homepage`, `Judgement`, and `Co-Directing` as custom information because coercing them into a standard label could change their meaning.
- Remove the legacy empty `Artists` record from `community-chat-2025`; do not invent a missing artist value.
- Move homepage URLs currently stored in the `Location` field for `peer-up-2023` and `peer-up-2024` into a custom `Homepage` record. Leave `Location` empty until a verified venue is supplied.
- Keep other absent locations and credits empty and hidden. Do not infer factual content.
- Apply equivalent normalization to both the managed D1 records and the static fallback data so API failures cannot reveal a different format.

## Validation and API behavior

- Publishing requires title, slug, dates, poster, body, and at least one credit record whose value is non-empty after trimming.
- A label-only credit row must not satisfy publish validation.
- Trim values, discard completely empty credit rows, preserve stable record order, and accept only valid `http` or `https` URLs.
- Save and publish must use the same normalization function so drafts and published payloads cannot diverge.
- Public payload construction and admin payload reconstruction must preserve custom labels and contributor URLs.

## Audit and regression protection

- Add a reusable metadata audit covering every Project and Show in managed and static data.
- Flag empty persisted credit rows, noncanonical standard aliases, raw URLs in `Location`, invalid dates, unsupported content types, and malformed link URLs.
- Allow populated custom labels while ensuring they appear after standard groups.
- Add a full admin round-trip test for both a Show and a Project: create draft, enter all basic information, save, reload, publish, and inspect the public payload.
- Verify the detail renderer hides missing fields and renders Instagram links as SVG icons without visible raw URLs.

## QA and deployment

- Run focused unit and integration tests before the full suite.
- Run lint and the Cloudflare Pages production build.
- Audit all current managed and fallback Project/Show records after normalization.
- Browser-check `/admin`, representative Show and Project detail pages, and desktop/mobile public lists.
- Back up the production D1 database before changing managed records.
- Deploy to production only after all checks pass, then smoke-test the custom domain and confirm newest-first Show ordering remains intact.
