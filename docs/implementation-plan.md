# 실행 예제 구현 계획

목표는 Docker가 있는 컴퓨터에서 소스를 수정하지 않고 Next·Spring·PostgreSQL과 로컬 OIDC를 실행하고, 검증 결과를 PPT의 같은 예제에 연결하는 것이다. 제품 계약은 [registration.md](registration.md)에 둔다.

1. **Spring와 PostgreSQL:** HTTP 계약 검사를 먼저 실패시키고 트랜잭션·DB 제약·인증을 구현한다. 실제 PostgreSQL에서 정원·중복·기존 결과·마감·권한과 runtime DB 권한을 검사한다.
2. **웹과 로그인:** NextAuth와 로컬 Keycloak으로 서버 세션을 구성한다. 웹 BFF의 Origin·body·인증 검사를 먼저 고정하고 신청 UX를 구현한다. 공개 session 응답에 토큰이 없는지 검사한다.
3. **실행 자동화:** `./dev`가 로컬 설정 생성, Compose 시작과 준비 확인, 검사, 결함 시연을 담당한다. 데이터 삭제는 별도 명시적 명령으로만 제공한다.
4. **AI 작업 환경:** AGENTS, 팀 Skill, 문서 MCP, 선택형 Stop hook과 검증 receipt를 제공한다. 파일의 구조 검사와 실제 클라이언트에서의 활성화 확인을 구분한다.
5. **공유·배포·강의:** 잠금 파일·Wrapper·CI·Terraform과 배포 스크립트를 제공한다. AWS 실행과 GitHub 게시를 수행하지 않는다. 검증한 결과·실제 경로·화면에 맞춰 PPT와 발표 대본을 갱신한다.

편집은 한 소유자가 수행하고, 인증·트랜잭션·배포와 전체 결과를 독립 읽기 전용 리뷰로 확인한다. 기존 `.DS_Store`와 내부 미추적 디렉터리는 보존한다. 사용자 요청 없이 커밋·푸시하지 않는다.
