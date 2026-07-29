# Admin Rental Window Calendar Implementation Plan

## Goal

관리자 화면에서 대관 가능/차단 일정을 캘린더로 생성, 수정, 삭제하고, 공개 대관 신청 캘린더와 동일한 상태 라벨/컬러를 사용한다. `space.ddf@gmail.com` iCal 기반 Google Calendar 일정도 관리자 가능일정 캘린더에 읽기 전용으로 함께 표시한다.

## Scope

1. Backend
   - 관리자용 `rental_windows` CRUD API 추가.
   - `available` 일정은 다른 `available` 일정과 중복 방지.
   - `blocked` 일정은 활성 신청(`new`, `reviewing`, `approved`)과 중복 방지.
   - 공개 대관 신청은 `blocked` 기간과 겹치면 거부.

2. Frontend Service
   - `fetch/create/update/deleteAdminRentalWindow` 추가.
   - 기존 Google Calendar fetch 서비스 재사용.

3. Admin UI
   - `신청내역 / 가능일정` 탭 추가.
   - 가능일정 탭: 왼쪽 월간 캘린더, 오른쪽 일정 입력/수정 패널.
   - DB 가능/차단 일정, 활성 대관 신청, Google Calendar iCal 일정을 동일한 캘린더에 표시.
   - Google Calendar 일정은 읽기 전용으로 표시하고 저장/수정 대상에서 제외.

4. Calendar Semantics
   - `rental-blocked` 타입을 store/style/calendar component에 추가.
   - 공개 캘린더에서도 차단 일정은 선택 불가.

5. Verification
   - API/프론트 정적 테스트 추가 후 통과.
   - `npm run build`.
   - Cloudflare Pages 배포 및 실제 도메인 확인.
