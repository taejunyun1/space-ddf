# Cloudflare Migration and Rental Reservation System Design

## Summary

Space DDF will move from the current FTP/cPanel-oriented static deployment flow to a Cloudflare-based operating model. The public Vue site will be deployed through Cloudflare Pages, and the rental reservation system will be built in the same project using Pages Functions, D1, and Turnstile.

The reservation system will not accept immediate payment in the first version. It will support a review-based workflow: applicants choose a rental period, submit project information, and Space DDF confirms or rejects the request after review. This matches the operational reality of an art space, where installation, deinstallation, support-program discounts, project suitability, and date conflicts require human review.

## Goals

- Remove FTP/ZIP upload as the main deployment path.
- Deploy the existing Vue/Vite site through Cloudflare Pages.
- Add a public rental page where visitors can view availability and submit rental requests.
- Add a backend API for availability lookup and request submission.
- Store rental availability and request state in Cloudflare D1.
- Add an administrator workflow for reviewing, holding, approving, rejecting, and cancelling rental requests.
- Protect public form submissions with Cloudflare Turnstile.
- Keep payment out of the first release; approved requests receive separate payment guidance later.

## Non-Goals

- No automatic payment capture in the first version.
- No file uploads in the first version.
- No multi-user staff permission model in the first version.
- No external calendar sync in the first version.
- No replacement of existing exhibition/project content management in the first version.

## Current Site Context

- Framework: Vue 3, Vite, Vue Router, Pinia.
- Current build: `npm run build` creates `dist/`, prerendered SEO pages, CSP hashes, and `release/space-ddf-cpanel.zip`.
- Current deployment: cPanel/FTP-oriented ZIP upload.
- Current routes include `/`, `/archive-map`, `/projects/:slug`, and `/shows/:slug`.
- Current home page already includes a display-only calendar component backed by `src/stores/calendar.js`.
- Existing calendar data is static and not suitable for live rental operations without a database-backed availability source.

## Recommended Architecture

```text
GitHub repository
  -> Cloudflare Pages build
    -> Vue static frontend
    -> /rental public rental page
    -> /admin/rentals admin rental dashboard
    -> /api/rentals/* Pages Functions
      -> Cloudflare D1 rental database
      -> Cloudflare Turnstile validation
```

Cloudflare Pages becomes the primary deploy target. Pages Functions handle server-side reservation logic under `/api`. D1 stores availability windows, rental requests, and status transitions. Turnstile protects the public request form from spam. The existing cPanel ZIP build can remain temporarily as a backup path, but it should not be the primary release workflow.

## Cloudflare Products

- **Cloudflare Pages**: Hosts and deploys the Vue/Vite frontend from Git.
- **Pages Functions**: Provides API routes in the same Pages project.
- **Cloudflare D1**: Stores rental windows, requests, and status transitions.
- **Cloudflare Turnstile**: Protects the public rental request form.
- **Cloudflare DNS**: Hosts DNS for the domain after nameserver migration.
- **Cloudflare Access**: Recommended for protecting `/admin/rentals` once admin flows are active.

References:

- Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Pages Functions: https://developers.cloudflare.com/pages/functions/
- D1: https://developers.cloudflare.com/d1/
- Turnstile server-side validation: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/

## DNS and Domain Migration

The domain currently appears to be managed by the hosting provider rather than Cloudflare. The recommended migration is to move DNS authority to Cloudflare by changing the domain nameservers at the current registrar/hosting provider.

Because Space DDF uses `space.ddf@gmail.com`, not a domain mailbox such as `info@space-ddf.com`, DNS migration does not need to preserve Google Workspace MX records for the current email workflow. If domain email is added later, MX, SPF, DKIM, and DMARC records must be configured before switching mail over.

Migration sequence:

1. Add the domain to Cloudflare.
2. Copy any existing DNS records that are still needed.
3. Create the Cloudflare Pages project and deploy the current site to the temporary `*.pages.dev` domain.
4. Add `space-ddf.com` and `www.space-ddf.com` as Pages custom domains.
5. Replace the current domain nameservers with the two Cloudflare nameservers.
6. Verify root domain, `www`, SPA routing, SEO routes, assets, and Google Maps/API behavior.
7. Keep the old cPanel deployment as a temporary rollback target until Cloudflare deploys are stable.

## Build and Deployment Changes

Add a Cloudflare Pages build command that does not package a cPanel ZIP:

```json
"build:pages": "npm run assets:manifest && vite build && npm run prerender && npm run csp:hashes"
```

Cloudflare Pages settings:

- Build command: `npm run build:pages`
- Output directory: `dist`
- Node version: match local development version if Cloudflare requires explicit configuration.

The existing `npm run build` can remain for now as a cPanel backup path because it creates `release/space-ddf-cpanel.zip`.

## Rental Workflow

### Public Flow

1. Visitor opens `/rental`.
2. Visitor reads rental guidance and available periods.
3. Visitor selects a requested date range.
4. Visitor enters:
   - applicant name
   - artist or team name
   - email
   - phone or preferred contact
   - project type
   - short project description
   - requested start date
   - requested end date
   - support-program discount eligibility
   - optional notes
5. Visitor completes Turnstile verification.
6. Visitor submits the request.
7. The system stores the request as `pending`.
8. Visitor sees a confirmation message explaining that Space DDF will review and respond separately.

### Admin Flow

1. Admin opens `/admin/rentals`.
2. Admin views pending, held, approved, rejected, and cancelled requests.
3. Admin opens a request detail view.
4. Admin checks date conflict and project details.
5. Admin can set status:
   - `pending`: newly submitted
   - `hold`: temporarily reserved while discussing details
   - `approved`: confirmed rental
   - `rejected`: declined
   - `cancelled`: removed after prior approval or hold
6. Approved and held ranges are shown as unavailable on the public calendar.
7. Payment guidance remains manual in the first version.

## Availability Rules

- Public applicants can submit requests only for date ranges that do not overlap with approved or held rentals.
- Admins can override conflicts only by changing existing statuses first.
- Existing exhibitions, projects, or internal blocked dates should be represented as unavailable ranges in the same availability system.
- Mondays or regular closed days can be shown visually, but they should not automatically block a full rental range unless Space DDF wants that rule.
- The first version treats date ranges as whole-day ranges, not hourly slots.

## Data Model

### `rental_windows`

Stores public availability windows and internal blocked periods.

```sql
CREATE TABLE rental_windows (
  id TEXT PRIMARY KEY,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'blocked')),
  label TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `rental_requests`

Stores submitted rental requests.

```sql
CREATE TABLE rental_requests (
  id TEXT PRIMARY KEY,
  applicant_name TEXT NOT NULL,
  team_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  project_type TEXT NOT NULL,
  project_description TEXT NOT NULL,
  requested_start_date TEXT NOT NULL,
  requested_end_date TEXT NOT NULL,
  support_program TEXT NOT NULL CHECK (support_program IN ('none', 'k-art', 'gwangju-foundation', 'other')),
  support_program_note TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'hold', 'approved', 'rejected', 'cancelled')),
  admin_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### `rental_status_history`

Stores admin status changes for auditability.

```sql
CREATE TABLE rental_status_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES rental_requests(id)
);
```

## API Design

### Public APIs

`GET /api/rentals/availability`

Returns public availability windows plus unavailable ranges derived from approved and held requests.

`POST /api/rentals/requests`

Validates Turnstile, validates form input, checks date conflicts, and creates a `pending` request.

### Admin APIs

`GET /api/admin/rentals/requests`

Returns request list filtered by status, date, and search query.

`GET /api/admin/rentals/requests/:id`

Returns a single request with status history.

`PATCH /api/admin/rentals/requests/:id/status`

Updates request status and writes to `rental_status_history`.

`POST /api/admin/rentals/windows`

Creates available or blocked windows.

`PATCH /api/admin/rentals/windows/:id`

Updates existing availability or blocked windows.

Admin APIs must be protected before production use. Cloudflare Access is the preferred protection layer for the admin surface.

## Frontend Pages and Components

### `/rental`

Public rental page. It should feel operational rather than promotional. It should include:

- concise rental intro
- availability calendar
- selected date summary
- rental request form
- discount note for K-ART, Gwangju Foundation, and similar support programs
- confirmation/error state after submission

### `/admin/rentals`

Admin dashboard. It should include:

- status tabs
- request list
- request detail panel
- conflict summary
- status action buttons
- admin note field

### Shared Components

- `RentalCalendar`: shows availability, held, approved, and blocked ranges.
- `RentalRequestForm`: handles public application input.
- `RentalStatusBadge`: shared status display.
- `RentalDateRangeSummary`: normalized selected range display.

## Security and Privacy

- Public form submissions must use Turnstile.
- Public APIs must validate input server-side.
- Admin APIs must require authentication before launch.
- Do not expose full applicant contact details in public API responses.
- Store only the contact and project data needed for rental review.
- Avoid file uploads in the first release to reduce privacy and storage complexity.

## Error Handling

- If availability cannot load, show a clear retry state and contact fallback.
- If a selected date conflicts at submission time, reject the request and ask the applicant to choose another range.
- If Turnstile validation fails, do not create a request.
- If the database write fails, show a generic failure message and preserve form input on the client.
- Admin status changes should fail safely and leave the previous status unchanged.

## Testing Strategy

- Unit tests for date range overlap and availability derivation.
- Unit tests for request validation.
- Worker/Pages Function tests for public request submission.
- D1 migration smoke tests.
- Frontend tests for rental page states:
  - load availability
  - select valid range
  - reject conflicting range
  - submit form
  - show confirmation
- Admin tests for status transitions and conflict checks.
- Build validation:
  - `npm run lint`
  - `npm run build:pages`
  - existing smoke tests adapted for Cloudflare Pages routing

## Rollout Plan

### Phase 1: Cloudflare Deployment Migration

Move the existing site to Cloudflare Pages without changing public behavior.

Acceptance criteria:

- `*.pages.dev` preview works.
- Existing routes render.
- SEO prerender output works.
- Assets load correctly.
- cPanel ZIP remains available as backup.

### Phase 2: DNS Cutover

Move DNS authority to Cloudflare and connect production domains.

Acceptance criteria:

- Root domain loads from Cloudflare Pages.
- `www` resolves correctly.
- HTTPS works.
- Existing routes and assets work after DNS propagation.

### Phase 3: Rental MVP

Add public rental request flow and D1-backed API.

Acceptance criteria:

- Public availability loads from API.
- Applicant can submit a valid request.
- Conflicting requests are rejected.
- Turnstile is validated server-side.
- Requests are stored in D1.

### Phase 4: Admin Review

Add protected admin dashboard for reviewing requests.

Acceptance criteria:

- Admin can view requests.
- Admin can change status.
- Held and approved requests become unavailable publicly.
- Status history is stored.

### Phase 5: Notifications and Payment

Add email notification and later payment workflow after the review-based system is stable.

Acceptance criteria:

- Applicant and admin notifications work.
- Payment process is added only after manual approval workflow is validated.

## Implementation Defaults

The first implementation plan should use these defaults unless Space DDF explicitly changes the product direction:

- Link `/rental` from the side navigation and from a compact call-to-action near the home calendar.
- Use Cloudflare Access for production admin protection. Local development may use a documented dev-only bypass.
- Do not send automated email in the first reservation MVP. Show an on-screen confirmation and let staff follow up manually.
- Do not implement payment in the first reservation MVP. Start with manual payment guidance after approval.

## Recommended Next Step

Create an implementation plan for Phase 1 through Phase 4. Phase 5 should remain out of scope until the reservation workflow is stable.
