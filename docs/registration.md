# 스터디 참가 신청의 완료 기준

Next.js 웹과 모바일이 같은 Spring API를 사용한다. Spring만 PostgreSQL의 신청을 확정한다.

## 첫 버전의 정책

- 정원 8명에 기등록 7명인 세션에 서로 다른 미신청 회원 두 명이 동시에 신청하면 신규 확정은 정확히 한 건, 정원 초과는 한 건, DB 최종 인원은 8명이다.
- 같은 회원의 동시 신청·재시도는 같은 신청 ID를 반환하며 행은 한 개만 존재한다. 신규 201, 기존 200이다.
- 기존 신청을 먼저 확인한다. 이미 확정된 신청은 마감 후나 정원이 찬 뒤에도 반환한다.
- 신규 신청의 마감은 세션 행 잠금을 얻은 **뒤** 주입한 서버 Clock으로 판정한다. 마감 시각과 같으면 마감이다.
- 신청자 ID는 검증한 JWT의 `sub`다. body의 회원 ID는 받지 않는다.
- 첫 버전에는 취소·대기열·결제·관리자 CRUD가 없다.

## 저장과 API 경계

`study_session(id, title, description, starts_at, closes_at, capacity)`와 `registration(id, session_id, member_subject, created_at)`를 사용한다.
`UNIQUE(session_id, member_subject)`는 중복 방어다. 정원은 같은 세션의 모든 쓰기가 동일한 `FOR UPDATE` 잠금과 READ COMMITTED 트랜잭션을 따를 때 보장한다.

`POST /sessions/{id}/registrations`는 빈 body 또는 `{}`만 받는다.

| 결과                  | HTTP | code                |
| --------------------- | ---: | ------------------- |
| 신규                  |  201 | CONFIRMED           |
| 기존                  |  200 | CONFIRMED           |
| 정원 초과             |  409 | SESSION_FULL        |
| 신규 마감             |  409 | REGISTRATION_CLOSED |
| 없는 세션             |  404 | SESSION_NOT_FOUND   |
| 인증 없음·잘못된 토큰 |  401 | UNAUTHENTICATED     |
| 신청 scope 없음       |  403 | FORBIDDEN           |
| 회원 ID 등 body 입력  |  400 | INVALID_REQUEST     |

웹 BFF는 `/api/sessions/{id}/registrations`에서 세션·Origin·JSON을 확인하고 사용자 access token을 Spring에 전달한다.
access token은 NextAuth의 공개 session 응답이나 브라우저 JavaScript에 반환하지 않는다. 만료 시 재로그인한다.

## 확인할 증거

실제 PostgreSQL 통합 검사, JWT 검증 검사, 독립 fixture의 동시 신청·기존 결과·잠금 대기 후 마감 검사, 브라우저 로그인부터 BFF까지의 E2E가 서로 다른 실패를 확인한다.
`./dev defect-demo`는 잠금 없는 **별도 SQL 실험**에서 9명을 재현한다. 정상 서비스의 동일 acceptance test를 변조한 mutation이라고 부르지 않는다.
