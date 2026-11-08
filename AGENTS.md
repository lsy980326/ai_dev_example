# 스터디 예약 예제 작업 규칙

이 저장소는 Next.js + Spring Boot + PostgreSQL 예제다. 제품 계약은 `docs/registration.md`, 화면 기준은 `DESIGN.md`다. 요청이 설명·리뷰라면 읽기 전용을 유지한다.

## 경계와 검사

- 웹은 `web/`, 공통 신청 규칙은 `api/src/main/java/dev/study/booking/`, DB 변경은 `api/src/main/resources/db/migration/`에 있다. 회원은 검증된 JWT sub에서 결정한다.
- 신청: 세션 행 잠금 → 기존 신청 → 잠금 뒤 Clock → 정원 → INSERT. 같은 회원의 기존 결과는 마감 후에도 반환한다. 유일 제약만으로 정원을 보장하지 않는다.
- PostgreSQL `FOR UPDATE`를 위한 `UPDATE(id)`와 정책 열 수정 권한을 구분한다. runtime 계정에 DDL·DELETE·capacity/closes_at 변경을 주지 않는다.
- JWT 서명·issuer·audience·필수 exp·회원 sub·scope와 BFF의 설정된 Origin을 유지한다. access token을 공개 session·브라우저 코드·로그에 반환하지 않는다.
- 가까운 회귀 검사를 먼저 실행하고 최종 `./dev verify`를 사용한다. Docker가 없다고 Testcontainers 검사를 skip하지 않는다. 검사를 완화해서 구현을 통과시키지 않는다.
- `./dev defect-demo`는 잠금 없는 별도 SQL 실험이다. 정상 서비스 코드를 변조한 동일 acceptance mutation으로 보고하지 않는다.
- `.local/` 임의 탐색, 실제 환경 파일·키·인증 설정의 읽기·출력을 금지한다. 검증 도구는 `.local/verification/`의 비밀 없는 receipt를 관리하며, 에이전트와 발표자는 `./dev status`가 내보내는 정제된 요약으로 결과를 확인한다. Secret은 출력하지 않는다.

## AI와 공유 자료

신청·정원·인증·트랜잭션 변경을 리뷰할 때 `registration-review` 스킬을 적용한다. 화면 작업에는 `frontend-design`과 `DESIGN.md`를 사용한다. 스킬·자연어 지침은 실행 권한과 CI를 대신하지 않는다.

`docs/slides-map.json`은 실제 코드와 강의 자료의 연결이다. 관련 경계나 명령을 바꾸면 해당 설명과 테스트 증거를 갱신한다. 파일 구조 검사와 실제 새 세션의 Skill/Hook/MCP 활성화를 구분해 보고한다.

원본·미추적 파일을 보존한다. 요청 없는 커밋·푸시·GitHub 설정 변경·AWS apply/deploy·credential 접근은 하지 않는다. 코드 작성 요청은 운영 배포 허가가 아니다.
