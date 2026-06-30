# Admin Rental Window Calendar Design

## Goal

Space DDF 관리자가 `/manage/rentals` 안에서 대관 가능한 일정을 캘린더로 생성, 수정, 삭제하고, 그 결과가 공개 대관 신청 화면의 캘린더와 같은 라벨 및 컬러 표현으로 표시되게 한다.

## Current Data Model

The existing rental reservation backend already has the correct core tables.

- `rental_windows` stores admin-managed date ranges.
- `rental_requests` stores visitor applications.
- `rental_status_history` stores status changes for applications.

The public rental request API already validates that a requested date range is inside a `rental_windows.status = 'available'` range and does not overlap active requests with `new`, `reviewing`, or `approved` status.

The admin feature should manage `rental_windows` directly instead of adding a second availability table.

## Admin Surface

The active manager entry remains:

- `/manage`
- `/manage/rentals`

Inside the rental manager, add a two-tab structure:

- `신청내역`
- `가능일정`

`신청내역` keeps the current request list and detail workflow.

`가능일정` uses a split layout:

- Left: monthly calendar
- Right: selected range editor

On desktop, the calendar and editor sit side by side. On mobile, the calendar appears first and the editor follows below, preserving the same compact DDF visual system.

## Calendar Behavior

The admin availability calendar should visually match the public rental calendar as closely as possible.

Shared labels:

- `전시`
- `워크샵`
- `예약 확정`
- `예약신청`
- `대관 가능`
- `차단`

Shared meaning:

- `대관 가능`: dates visitors can choose inside the rental request flow.
- `예약신청`: a visitor request in `new` or `reviewing` status.
- `예약 확정`: a visitor request in `approved` status.
- `차단`: admin-defined unavailable dates, such as internal install, maintenance, or private use.

Shared color intent:

- `대관 가능`: same public calendar rental-available color.
- `예약신청`: same public calendar requested rental color.
- `예약 확정`: same public calendar confirmed rental color.
- `차단`: neutral gray/black system color.
- Existing exhibition and workshop colors stay unchanged.

The admin calendar should reuse the existing calendar event type model where possible:

- `rental-available`
- `rental-requested`
- `rental`
- `rental-blocked`
- `exhibition`
- `workshop`

## Selection Flow

The manager can create a date range by selecting dates in the left calendar.

Minimum supported interaction:

1. Click a start date.
2. Click an end date.
3. The selected range appears in the right editor.

The editor can also expose date inputs so the manager can correct dates without reselecting in the calendar.

The selected range should use the same visual selected-range treatment as the public rental request calendar.

## Right Editor

The editor fields:

- `시작일`
- `종료일`
- `상태`: `대관 가능` or `차단`
- `라벨`
- `관리자 메모`

Default values for a new range:

- `상태`: `대관 가능`
- `라벨`: selected month based, for example `7월 대관 가능 일정`
- `관리자 메모`: empty

Editor actions:

- `일정 저장`
- `일정 수정`
- `일정 삭제`
- `선택 초기화`

Use icon plus text buttons, matching the current admin action button direction.

## API Surface

Add password-protected manager APIs under the existing `/api/manage` namespace:

- `GET /api/manage/rentals/windows`
- `POST /api/manage/rentals/windows`
- `PATCH /api/manage/rentals/windows/:id`
- `DELETE /api/manage/rentals/windows/:id`

Legacy `/api/admin` aliases may exist, but the frontend should use `/api/manage`.

The public APIs remain:

- `GET /api/rentals/availability`
- `POST /api/rentals/requests`

## Validation Rules

All write operations must validate on the server, not only in the frontend.

Date validation:

- `startDate` and `endDate` must be `YYYY-MM-DD`.
- `endDate` must be the same as or after `startDate`.
- Empty labels are rejected.
- Status must be `available` or `blocked`.

Availability consistency:

- `available` windows should not overlap other `available` windows.
- `blocked` windows may overlap `available` windows because they carve out unavailable sub-ranges.
- `blocked` windows should not overlap active requests unless the manager explicitly resolves those requests first. Active request statuses are `new`, `reviewing`, and `approved`.
- Editing an existing window ignores itself for overlap checks.

Public request consistency:

- A visitor request must be fully inside at least one `available` window.
- A visitor request must not overlap any `blocked` window.
- A visitor request must not overlap requests with `new`, `reviewing`, or `approved`.
- Requests with `rejected` or `cancelled_by_user` do not block dates.

Deletion consistency:

- Deleting an `available` or `blocked` window never deletes existing rental requests.
- If a window intersects active requests, the API returns a conflict response.
- Force-delete is not part of this implementation.

## Frontend Data Flow

The admin availability tab loads one combined availability payload for manager use:

- windows from `rental_windows`
- unavailable ranges from active `rental_requests`

The public rental page continues to load `/api/rentals/availability`.

After creating, editing, or deleting a window:

1. The manager availability list refreshes.
2. The admin calendar updates.
3. The public rental page reflects the same data on the next fetch.

No realtime subscription is required.

## Error Handling

Use visible admin notices, matching existing manager behavior.

Expected error messages:

- Invalid date: `일정 날짜를 확인해주세요.`
- Overlapping available window: `이미 등록된 대관 가능 일정과 겹칩니다.`
- Blocked range conflicts with active request: `예약신청 또는 승인된 대관 일정과 겹칩니다.`
- Delete conflict: `활성 신청내역이 있는 일정은 삭제할 수 없습니다.`
- Network/API failure: `대관 가능 일정을 저장하지 못했습니다.`

## Testing Requirements

Backend tests:

- List rental windows for manager.
- Create available window.
- Reject overlapping available windows.
- Create blocked window inside available window.
- Reject public request when range overlaps blocked window.
- Reject delete when a window intersects active requests.
- Allow delete when no active request intersects.

Frontend source tests:

- Admin page exposes `신청내역 / 가능일정` tabs.
- Availability tab renders a calendar/editor split.
- Availability tab uses the same calendar event type labels as the public calendar.
- Service module calls `/api/manage/rentals/windows`.
- Editor has save, update, delete, and reset actions.

Rendered verification:

- Login to `/manage/rentals`.
- Open `가능일정`.
- Confirm the calendar is not blank.
- Confirm legend/marks visually match the public rental calendar labels.
- Select a date range and confirm the editor receives the dates.
- Save a test blocked window only against a non-production or disposable test range, or use API mocks/local D1.

## Out of Scope For First Implementation

- Payment.
- Realtime calendar updates.
- Multi-space resource management.
- Force-delete with cascading request changes.
- Google Calendar writeback.
- Drag-and-drop resizing of existing windows.
