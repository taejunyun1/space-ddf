# Space DDF Rental Backend Deployment

This project uses Cloudflare Pages Functions and D1 for the rental reservation MVP.

## Pages Build

Cloudflare Pages settings:

- Build command: `npm run build:pages`
- Output directory: `dist`
- Functions directory: `functions`

The public APIs are deployed under:

- `GET /api/rentals/availability`
- `POST /api/rentals/requests`
- `GET /api/calendar/google`

The active manager APIs are deployed under:

- `GET /api/manage/rentals/requests`
- `PATCH /api/manage/rentals/requests/:id/status`

The removed `/api/admin/*` aliases are not deployed. Manager APIs exist only under `/api/manage/*`.

## D1 Setup

Create the rental database:

```bash
npx wrangler d1 create space-ddf-rentals
```

Copy `wrangler.pages.example.jsonc` to `wrangler.jsonc`, then replace `database_id` with the ID returned by Cloudflare:

```bash
cp wrangler.pages.example.jsonc wrangler.jsonc
```

Apply the migration locally if needed:

```bash
npx wrangler d1 migrations apply space-ddf-rentals --local
```

Apply the migration to the remote D1 database:

```bash
npx wrangler d1 migrations apply space-ddf-rentals --remote
```

## Bindings

In the Pages project, add a D1 binding:

- Binding name: `DB`
- Database: `space-ddf-rentals`

Set the production environment variable `MANAGE_AUTH_USER=ddf`.

Set production secrets:

```bash
npx wrangler pages secret put MANAGE_AUTH_PASSWORD --project-name space-ddf-home
npx wrangler pages secret put MANAGE_AUTH_SECRET --project-name space-ddf-home
```

`MANAGE_AUTH_PASSWORD` is the password typed on the `/admin` login screen. `MANAGE_AUTH_SECRET` signs the manager session cookie and should be a long random string. Do not commit either value.

## Rental Notification Email

새 대관 신청이 D1에 저장되면 Cloudflare Email Service를 통해 아래 주소로 관리자 알림을 발송합니다.

- 발신: `Space DDF <rental@spaceddf.xyz>`
- 수신: `space.ddf@gmail.com`
- 답장 주소: 신청자 연락처가 이메일이면 신청자 이메일, 아니면 `space.ddf@gmail.com`
- Pages service binding: `RENTAL_NOTIFICATION_EMAIL` -> `space-ddf-rental-email`
- Worker email binding: `RENTAL_NOTIFICATION_EMAIL_PROVIDER`

`rental@spaceddf.xyz`는 발송 전용 주소이므로 별도의 받은편지함을 만들 필요가 없습니다. Pages Functions는 `send_email` 바인딩을 직접 지원하지 않으므로 외부 주소가 없는 전용 Worker를 Service Binding으로 호출합니다.

1. `Compute > Email Service > Email Routing`에서 `spaceddf.xyz`를 활성화합니다.
2. 대상 주소 `space.ddf@gmail.com`을 추가하고 인증 메일의 링크를 눌러 `인증됨` 상태로 만듭니다.
3. `npx wrangler deploy -c wrangler.email-worker.jsonc`로 전용 Worker를 먼저 배포합니다.
4. `npx wrangler deploy -c wrangler.rental-ops.jsonc`로 메일 재시도·휴지통 정리 Worker를 배포합니다.
5. `npx wrangler deploy -c wrangler.www-redirect.jsonc`로 `www.spaceddf.xyz` 요청을 대표 도메인 `spaceddf.xyz`로 301 이동시킵니다.
5. `npx wrangler pages deploy dist --project-name space-ddf-home`으로 Pages를 배포합니다.
6. Pages 프로젝트의 `RENTAL_NOTIFICATION_EMAIL` Service Binding이 `space-ddf-rental-email`을 가리키는지 확인합니다.
7. 공개 대관 페이지에서 테스트 신청을 한 건 접수합니다.
8. `space.ddf@gmail.com` 수신 여부와 답장 주소를 확인합니다.
9. `/admin`의 렌탈 관리 화면에서 `메일 발송됨` 상태를 확인한 뒤 테스트 신청을 삭제합니다.

메일 발송이 실패해도 신청은 D1에 정상 저장됩니다. 관리자 상세 화면에는 `메일 발송 실패`로 표시되며, 공급자 오류 원문이나 신청자의 개인정보는 오류 필드에 저장하지 않습니다.

## Google Calendar Sync

The homepage calendar can sync events from the Space DDF Google Calendar without exposing the private feed URL to browsers.

In Google Calendar, open the `space.ddf@gmail.com` calendar settings and copy the private `Secret address in iCal format`. Treat this URL like a password.

Set it as a Cloudflare Pages production secret:

```bash
npx wrangler pages secret put GOOGLE_CALENDAR_ICAL_URL --project-name space-ddf-home
```

The Pages Function `GET /api/calendar/google` reads this secret server-side, expands recurring events and exceptions, and returns only the past 12 months through the next 18 months. Google events are display-only and never participate in rental conflict checks. A sync failure returns the last successful cache or an empty list, so rental requests continue to work.

## Admin Access

The current production setup does not use Google or Cloudflare Access login for the active manager surface. The only manager entry path is `/admin`.

Unauthenticated visitors see the login form at `/admin`. After login, the site sets a signed `HttpOnly` session cookie for 12 hours.

The active manager APIs are:

- `GET /api/manage/rentals/requests`
- `PATCH /api/manage/rentals/requests/:id/status`

These APIs require the same signed manager session cookie, so the "신청내역 불러오기" and status action buttons work only after the password login.

Legacy manager page paths are not deployed. If a Cloudflare Access application is attached to `/admin*`, Cloudflare will intercept the request before the password login page. Remove the Access application or exclude `/admin*` when using the built-in password login.

All state-changing manager API requests also require a same-origin `Origin` header.

## Local Function Preview

Build and run the Pages preview:

```bash
npm run build:pages
npx wrangler pages dev dist --d1=DB=space-ddf-rentals
```

For local testing, set:

```bash
MANAGE_AUTH_USER=ddf
MANAGE_AUTH_PASSWORD=local-password
MANAGE_AUTH_SECRET=local-session-secret
GOOGLE_CALENDAR_ICAL_URL=https://calendar.google.com/calendar/ical/.../basic.ics
```
