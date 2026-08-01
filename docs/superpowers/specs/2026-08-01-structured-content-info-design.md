# Structured Content Information Design

## Goal

Show exhibition and project metadata in the established Space DDF detail-page format, and make the same metadata structure explicit in `/admin` during upload and editing.

## Detail page

- Keep the existing poster, date, location, introduction, and body layout.
- Render standard credit groups in this fixed order: `Artists`, `Curating`, `Critic`, `Graphic`, `Support`, `Archive`, `Directing`.
- Always render the standard labels, including labels with no value, matching the supplied reference screenshots.
- Group repeated contributors under one label. For example, five artist records render on one `Artists` row rather than five separate rows.
- Render each Instagram-linked contributor as their visible name followed by the existing Instagram SVG icon. Never expose the URL as visible text.
- Preserve non-Instagram links as text links.
- Render unknown/custom credit labels after the standard groups so existing content such as `Homepage` remains compatible.
- Normalize legacy/current aliases when displaying and editing:
  - `Artist`, `Artists`, `참여작가`, `작가` → `Artists`
  - `기획`, `Curator`, `Curating` → `Curating`
  - Korean equivalents for the remaining standard labels map to their English display labels.

## Admin editor

- Move structured credits into the `1. 기본 정보` section beneath date and location.
- Show fixed fields for all seven standard credit groups.
- `Artists` is a repeatable contributor field. Each row has a name and an optional Instagram URL, with add/remove controls.
- Other standard groups accept a value and optional URL while retaining repeatable records from existing data.
- Keep a custom-credit area for unknown labels so editing and saving old content never discards data.
- The `2. 내용` section contains only the short introduction and main body.
- Continue using the existing composition-safe input handlers so Korean IME input is not interrupted.
- New drafts initialize the seven standard groups logically through the editor view without requiring empty database rows.

## Data model and compatibility

- Keep the existing `content_credits(label, value, url, sort_order)` table and API payload. No D1 migration is required.
- Add shared credit normalization/grouping helpers used by both the admin editor and detail page.
- Saving converts the structured editor state back to the existing ordered credits array.
- Publishing still requires at least one non-empty credit value; empty standard labels are a presentation/editor affordance and are not stored as meaningless rows.

## Validation and failure handling

- Instagram URLs are optional, but when provided must remain valid `http`/`https` links under the existing API normalization.
- Empty contributor rows are ignored when saving.
- Invalid or unknown legacy labels remain available as custom credits instead of being deleted.

## QA

- Unit-test alias normalization, standard ordering, grouping, empty-label rendering data, Instagram classification, and conversion back to API credits.
- Test that `/admin` exposes the fixed basic-information labels and keeps IME-safe handlers.
- Test that the detail page uses grouped structured credits and Instagram SVG icons.
- Run lint, the complete test suite, and the Cloudflare Pages build.
- Browser-check `/admin`, the `멸망 언박싱` detail page, and mobile layouts; verify no visible Instagram URLs or horizontal overflow.
- Deploy to the production Pages branch and run production smoke tests.
