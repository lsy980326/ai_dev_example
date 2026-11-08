# AI와 함께 바꾸는 순서

대상 독자는 2년차 개발자다. 문법 생성은 도구에 맡기되 제품 결정과 검증 결과의 판단은 개발자가 맡는다. 이 저장소의 같은 예약 예제를 설계 → 명세 → 실패 테스트 → 구현 → 독립 리뷰 → CI → 배포 순서로 따라간다.

## 1. 인터뷰로 모호한 제품 결정을 드러낸다

프로젝트 폴더를 Codex/Claude Code에서 연 뒤 아래 요청을 그대로 붙여넣는다.

```text
AGENTS.md와 docs/registration.md를 먼저 읽어.
스터디 참가 신청을 설계하려고 해. 지금은 코드를 바꾸지 마.
사용자 행동과 운영 정책 중 아직 결정하지 않은 것만 인터뷰해 줘.
한 번에 질문 1개, 가능한 선택지와 각각의 결과를 설명해 줘.
이미 문서에서 확정된 내용은 다시 묻지 마.
인터뷰 뒤에는 결정·가정·미결정·이번 범위 밖을 구분한 명세 초안을 보여 줘.
```

예: “응답이 끊겼는데 실제 신청은 성공했으면?” → “재시도는 기존 신청 번호를 반환한다.” “마감 후 재시도도?” → “기존 결과는 다시 보여주고 신규 신청만 거절한다.” 이 대화는 `docs/registration.md`의 규칙과 `existingRegistrationIsReturnedAfterDeadlineAndAtCapacity` 테스트로 연결된다. 번호표부터 외우는 수업이 아니다.

## 2. 대화를 실행 가능한 계약으로 바꾼다

```text
확정된 정책을 바탕으로 변경할 API 응답과 DB 불변식을 먼저 정리해.
테스트 파일을 제안하고, 테스트가 현재 코드에서 실패하는지 실제 실행해.
가짜 DB로 동시성을 흉내 내지 말고 이 저장소의 Testcontainers PostgreSQL을 써.
아직 구현하지 마. 테스트 실패가 의도한 정책 때문인지 설명해 줘.
```

예제의 증거 연결:

| 인터뷰의 답                      | 명세/코드                           | 검증                                    |
| -------------------------------- | ----------------------------------- | --------------------------------------- |
| 마지막 한 자리에는 한 명만       | 세션 행 잠금 후 정원 계산           | API 동시 요청 201·409, 실제 DB 최종 8명 |
| 같은 사람이 다시 눌러도 한 건    | 잠금 후 기존 신청 우선 조회, UNIQUE | 동시 재시도 200·201, 같은 신청 번호     |
| 기다리다 마감돼도 신규 신청 거절 | 잠금 획득 후 Clock 조회             | 실제 DB 잠금 대기 중 시간을 이동        |
| 타인 이름으로 신청할 수 없음     | JWT sub, 빈 JSON body               | body memberId 400, JWT/권한 검사        |

## 3. 범위를 좁혀 구현하고 따로 리뷰한다

```text
확정한 실패 테스트를 통과시키는 최소 변경을 구현해.
$registration-review 절차를 사용해 DB·인증·재시도 경계를 확인해.
테스트의 기대값을 완화하거나 예외를 숨기지 마.
완료 후 ./dev verify를 실행하고 실제 결과만 보고해.
AWS 변경, GitHub 게시, 커밋은 하지 마.
```

다른 읽기 전용 세션에 “git diff와 계약을 비교해 정원·신원·권한·배포 순서의 결함만 찾아줘. 파일은 고치지 마.”라고 요청하면 작성자의 가정을 다시 확인할 수 있다. 리뷰 의견도 테스트와 현재 코드로 판단한다.

## 스킬: 재사용할 작업 절차

이 저장소는 프로젝트 로컬 스킬을 이미 포함한다. 공유받은 사람이 전역 설치 명령을 실행할 필요가 없다.

- Codex: `.agents/skills/registration-review/SKILL.md`, `.agents/skills/frontend-design/`
- Claude Code: `.claude/skills/`에 같은 파일
- `frontend-design`은 Anthropic 공식 저장소의 특정 커밋에 고정하고 Apache 라이선스와 SHA-256 출처를 함께 보관한다. `./dev skills-install`은 그 고정본을 복원하며 임의의 최신 스크립트를 실행하지 않는다.
- 내 규칙은 `registration-review`에, UI 방향은 `DESIGN.md`에 기록한다. 외부 스킬을 무조건 여러 개 넣으면 충돌과 문맥 비용이 늘 수 있다.

`./dev skill-check`는 파일 구조·동일성·출처 해시를 검사한다. **실제 선택 여부는 새 프로젝트 세션의 `/skills`에서 확인한다.** 설명이 작업에 맞으면 에이전트가 기존 스킬을 자동 선택할 수 있다. 새 스킬 파일을 자동으로 만들고 검증해 준다는 뜻은 아니다. 스킬 생성을 요청했을 때도 범위·테스트·출처를 검토한다.

좋은 외부 스킬을 찾을 때는 공식 저장소 → 필요한 절차가 있는지 읽기 → 라이선스·스크립트·네트워크/쓰기 권한 검토 → 커밋 고정 → 작은 작업에서 평가 순서로 진행한다. 저장소 지시문을 읽었다고 배포 권한을 얻는 것은 아니다.

## MCP: 도구와 외부 자료에 연결하는 규약

두 호스트의 프로젝트 설정에는 **공식 OpenAI 문서 읽기 전용 MCP** 하나만 포함한다. `.codex/config.toml`과 `.mcp.json`을 비교하면 호스트별 형식 차이를 볼 수 있다. `./dev mcp-check`는 공개 서버의 initialize 응답을 검사한다. 현재 채팅에서 연결됐다는 증거는 아니다. 새 프로젝트를 신뢰하고 `/mcp` 목록을 확인한다. 문서 MCP는 AWS를 배포하지 않으며, AWS 접근 권한을 주지도 않는다.

## 하네스: 절차를 실제 실행 경계로 연결

`AGENTS.md`는 작업 규칙, 스킬은 절차, MCP는 도구 연결, Stop hook은 완료 시 검사, CI는 서버에서 다시 실행하는 검사다. 서로 다른 역할이다.

Stop hook은 현재 소스 해시와 성공한 `./dev verify` receipt를 비교한다. 변경 후 예전 성공 결과를 재사용하면 `decision:block`을 반환한다. `stop_hook_active`로 무한 반복을 피한다. 이 장치는 샌드박스나 보안 경계가 아니며 에이전트가 바꿀 수 있다. PR의 필수 CI와 사람의 리뷰도 필요하다.

새 프로젝트 세션에서 `/hooks`로 이 저장소의 정의를 확인하고 호스트가 요구하는 신뢰 검토를 마친다. Codex의 프로젝트 설정과 비관리 훅은 신뢰 조건이 있다. **파일을 넣었다고 현재 채팅에 자동 활성화됐다고 간주하지 않는다.** `./dev status`는 비밀 없는 검증 요약만 출력한다.

## 공식 자료

확인일 2026-11-08. 설정과 제품 기능은 변경될 수 있어 아래 원문을 기준으로 확인한다.

- [Codex skills](https://learn.chatgpt.com/docs/build-skills), [hooks](https://learn.chatgpt.com/docs/hooks), [project configuration](https://learn.chatgpt.com/docs/config-file/config-basic)
- [OpenAI 문서 MCP](https://developers.openai.com/learn/docs-mcp)
- [Claude Code skills](https://code.claude.com/docs/en/skills), [hooks](https://code.claude.com/docs/en/hooks), [MCP](https://code.claude.com/docs/en/mcp)
- [Anthropic 공식 frontend-design 고정본](https://github.com/anthropics/skills/tree/2c5958ecac7cee2b583967a2c4981d0f4a75c579/skills/frontend-design)
