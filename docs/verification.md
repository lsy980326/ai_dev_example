# 확인할 결과

`./dev verify`는 웹 정적 검사·단위 테스트·빌드 → 실제 PostgreSQL API/권한 테스트 → 의도적으로 잘못된 SQL 반례 → 하네스/배포 판정 테스트 → 독립 로그인/브라우저 시나리오 → Terraform 검증을 실행한다. 실패하면 즉시 멈추고 전체 성공 receipt를 만들지 않는다. 최종 소스 해시가 검사 시작 때와 같아야 성공한다.

| 명령                | 확인할 결과                                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `./dev up`          | localhost:3000, 자동 생성 로컬 비밀·DB 역할·스키마·시연 데이터·OIDC                                                                               |
| `./dev demo`        | 별도 임시 Compose 프로젝트에서 실제 로그인, 두 사용자 경쟁, 동일 신청 재시도, 응답 유실 후 복구, 변조 세션 401. 종료 시 그 프로젝트의 볼륨만 제거 |
| `./dev defect-demo` | 잘못된 SQL이 7명을 읽은 후 9명을 확정. JUnit 정원 검사 실패를 확인하면 시연 명령은 성공. 컴파일·DB 시작 오류는 성공으로 인정하지 않음             |
| `./dev skill-check` | 스킬 사본/출처/라이선스/설정 구조. 호스트 활성화 여부와 별개                                                                                      |
| `./dev mcp-check`   | 공식 문서 서버의 읽기 전용 MCP initialize 응답                                                                                                    |
| `./dev infra-check` | Terraform backend 없는 init, fmt, validate. AWS 연결·비용·실제 배포 검증은 아님                                                                   |
| `./dev status`      | 현재 코드와 맞는 전체 성공 결과인지, 오래된 결과인지 출력                                                                                         |

`--host` 옵션은 Node/Java21이 이미 있는 개발자용이다. 보통은 Docker 기반 기본 명령만 사용한다. Docker socket을 연결하는 검증 컨테이너는 신뢰한 저장소에서만 실행한다. PR의 테스트 코드는 CI 러너의 Docker 접근 권한을 얻으므로 production 비밀은 PR 검증에 제공하지 않는다.

API 테스트는 두 종류다. `JwtPolicyTest`는 실제 임시 RSA 서명/JWKS 서버로 decoder를 검증하고, `RegistrationIntegrationTest`는 MockMvc JWT로 신원을 주입해 실제 PostgreSQL의 정책·권한·동시성을 검증한다. MockMvc 테스트 하나가 전체 OIDC 로그인을 검증했다고 말하지 않는다. 그 연결은 별도 Playwright 시나리오가 확인한다.

GitHub에 올린 다음 Settings → Rulesets/Branch protection에서 `verification` 검사를 필수로 지정한다. YAML만 추가하면 병합이 자동 차단되는 것은 아니다. production Environment의 required reviewer와 배포 변수를 별도로 설정한다.

## 실패했을 때

- Docker 연결 오류: Docker Desktop/Engine 시작 후 `./dev doctor`.
- Docker 내부 `No space left on device`: Docker 저장 공간 확인. 다른 프로젝트의 볼륨이나 DB를 지우지 않는다. 캐시 정리도 영향을 확인한 뒤 수행한다.
- 3000/18080/18081 포트 충돌: 기존 소유자를 확인하고 충돌을 해소한다. 다른 프로젝트를 무작정 중지하지 않는다. PostgreSQL은 호스트에 포트를 열지 않는다.
- 첫 실행은 이미지·의존성 다운로드 때문에 오래 걸릴 수 있다. Docker 메모리 4GB 이상과 여유 디스크 15GB 이상을 권장하며 실제 필요량은 캐시에 따라 달라진다.
- 데모 계정은 로컬 전용이다. production에는 이 Keycloak start-dev와 공개 비밀번호를 배포하지 않는다.
- 로컬 realm 파일을 바꿔도 기존 Keycloak DB의 realm은 재수입되지 않는다. `./dev demo`는 새 임시 DB로 확인한다. 평소 로컬 데이터를 초기화할 때만 `./dev reset-demo --yes`.

프레젠테이션과 코드의 연결은 `docs/slides-map.json`에 있다. 화면, 명세, 코드, 테스트가 어긋나면 문서와 코드를 함께 수정한다.
