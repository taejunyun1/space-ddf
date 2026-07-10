# Space DDF Rental Request Email Notification Design

Date: 2026-07-10

## Goal

Send a transactional notification to `space.ddf@gmail.com` whenever a visitor successfully submits a new rental request. A temporary email delivery failure must not reject or remove the rental request.

## Scope

This iteration sends one administrator notification for each newly created rental request. It does not send applicant confirmations, status-change emails, marketing email, or automated retries.

## Delivery Provider

Use Cloudflare Email Service through a Pages Functions `send_email` binding. This keeps delivery inside the existing Cloudflare Pages and D1 architecture and does not require an external API key in application code.

The sender is `Space DDF <rental@spaceddf.xyz>`. The recipient and reply-to address are both `space.ddf@gmail.com`.

`rental@spaceddf.xyz` is a sending identity only. It does not require a mailbox. The `spaceddf.xyz` domain must be onboarded to Cloudflare Email Sending before production delivery is enabled.

Restrict the binding to the fixed destination `space.ddf@gmail.com` and the sender `rental@spaceddf.xyz` where the Pages binding configuration supports those restrictions.

## Notification Content

Subject:

`[Space DDF] 새 대관 신청 - {신청자명}`

Both HTML and plain-text bodies include:

- applicant or team name
- contact information
- requested start and end dates
- selected support program
- project description
- a link to `/manage/rentals`

All dynamic values are escaped before insertion into HTML. The message does not include secrets, authentication data, or internal administrator notes.

## Data Flow

1. The public request API validates the input, available window, blocked windows, and conflicting requests using the existing rules.
2. The API writes the rental request and initial status history to D1.
3. The request is marked with notification status `pending`.
4. The API schedules the email send using the Pages Functions execution context so the visitor does not wait for external delivery.
5. A successful send updates the notification status to `sent` and records the attempt time.
6. A failed or unavailable send updates the notification status to `failed` and stores only a sanitized error code.
7. The public API still returns a successful rental-request response after the request is stored, regardless of the notification result.

## Persistence

Add notification metadata to `rental_requests`:

- `notification_status`: `pending`, `sent`, or `failed` for new requests; existing rows use `not_applicable`
- `notification_attempted_at`: the latest send attempt time, nullable
- `notification_error_code`: a short sanitized failure code, nullable

No applicant content or provider response body is copied into the notification error field.

## Administrator Experience

The administrator request list and detail view expose the notification state with concise Korean labels:

- `메일 발송 대기`
- `메일 발송됨`
- `메일 발송 실패`

The failure state explains that the rental request itself was saved normally. This iteration does not add a manual retry button.

## Failure Handling

- D1 validation or insertion failure: return the existing API error and do not send email.
- Email binding missing: save the request, mark notification as `failed`, and record `email_binding_unavailable`.
- Cloudflare delivery call throws or rejects: save the request, mark notification as `failed`, and record `email_send_failed`.
- Notification-status update fails after a send attempt: do not modify the rental request status and avoid logging applicant data.

The application must not expose Cloudflare provider errors or stack traces to the visitor.

## Security and Privacy

- Do not hardcode API tokens or credentials.
- Use the Cloudflare binding instead of a browser-side request.
- Restrict the destination to `space.ddf@gmail.com` in configuration.
- Escape all HTML fields and generate a plain-text alternative.
- Keep applicant contact information out of generic console logs and error strings.
- Preserve existing public form validation and administrator access controls.

## Testing

Automated tests cover:

- a valid request is saved before notification dispatch
- the message uses the required sender, recipient, reply-to, subject, and administrator URL
- dynamic HTML values are escaped
- successful delivery records `sent`
- missing binding records `failed` without changing the successful request response
- provider failure records `failed` without changing the successful request response
- administrator normalization and UI labels expose each notification state
- existing rental request, availability, and administrator tests remain green

Production verification covers:

- Cloudflare Email Sending shows `spaceddf.xyz` as active
- a real request reaches `space.ddf@gmail.com`
- the email reply action targets `space.ddf@gmail.com`
- the administrator page shows the matching delivery state

## Deployment Prerequisites

1. Re-authenticate Wrangler or use the Cloudflare dashboard because the current CLI session returns an unauthorized response for Email Sending administration.
2. Onboard `spaceddf.xyz` under Cloudflare Email Service > Email Sending.
3. Confirm the Cloudflare-managed sending DNS records are active.
4. Add the restricted email binding to the Pages project configuration.
5. Apply the D1 migration before deploying the application code.
