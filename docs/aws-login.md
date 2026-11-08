# AWS 실습 범위·배포 방식·로그인

기본 실습은 로컬에서 끝난다. Next·Spring·PostgreSQL·Keycloak을 Docker로 실행하고 실제 로그인·동시 신청·재시도를 검사했다. AWS는 Terraform 구성과 배포 스크립트를 작성하고 정적 검증까지만 수행했다. **이 작업에서는 AWS 계정 로그인, 리소스 생성, 운영 배포를 하지 않았다. 이 작업으로 AWS 배포 리소스 요금을 발생시키지 않았다.**

이 문서의 AWS 로그인·plan·apply·배포 명령은 향후 운영자가 실행할 설명용 예시다. 현재 실행한 명령으로 읽지 않는다. PPT의 AWS 추가 설명 43–48장과 연결하며, 기본 코드 투어 1–42장 뒤에 약 20분을 더해 사용할 수 있다.

## 실습의 현재 범위

| 구분 | 준비·확인한 것 | 현재 수행 여부 |
|---|---|---|
| 로컬 앱 | Docker Compose·시연 DB·앱 OIDC 로그인·예약 UI/API | 실행·검증 완료 |
| 로컬 검사 | API/JWT·실제 PostgreSQL·웹·브라우저·SQL 반례·하네스 | 실행·검증 완료 |
| AWS 코드 | VPC·ALB·CloudFront·ECR·ECS·RDS·IAM·배포 스크립트 | 작성, init(-backend=false)·fmt·validate 완료 |
| AWS 계정 | Console/CLI 로그인·실계정 권한 확인·실계정 plan | 미실행 |
| AWS 운영 | apply·Secret 초기 주입·이미지 push·bootstrap·migration·서비스 배포 | 미실행 |
| GitHub 운영 | 원격 Actions·필수 검사·승인자·운영 Environment 설정 | 미실행 |

`./dev up`, `./dev verify`, `./dev demo`는 이 예제의 로컬 작업이다. `./dev infra-check`도 공급자 설치와 구성 검증이며 AWS의 실제 네트워크·권한·운영 성공을 증명하지 않는다. Terraform validate는 원격 서비스 검증을 수행하지 않는다. [Terraform validate](https://developer.hashicorp.com/terraform/cli/commands/validate)

## EC2에서 직접 배포하는 방식과 이 예제의 선택

아래 EC2 흐름은 익숙한 직접 운영 방식의 대표 예시다. 사용자의 실제 운영 이력을 단정한 것이 아니다.

```text
EC2 직접 운영 예시
빌드한 Next 산출물 + Spring jar
→ 승인된 배포 계정으로 SSH/SCP 또는 관리 도구 사용
→ EC2의 배포 디렉터리에 새 버전 배치
→ systemd/PM2 등의 프로세스 관리자로 실행·재시작
→ Nginx가 웹/API로 요청 분배 → health·업무 확인

이 저장소의 컨테이너 배포
CI 검증 → web/api 이미지 빌드 → ECR에 커밋 태그로 보관
→ digest로 실행 대상 고정
→ migration 성공 → Spring 새 Task 안정화 → Next 새 Task 안정화
→ 기대 revision·공개 health/API 확인
```

직접 운영에서는 OS·Node/JDK·프로세스·포트·로그·인증서 갱신과 파일 교체·복구 방법을 팀이 관리한다. 자동화가 부족하면 서버별 설정이나 배포 시점의 상태 차이를 추적하기 어렵다. 이 예제에서는 Dockerfile과 Task Definition에 실행 설정을 남기고 새 Task로 교체하며 이전 digest를 복구 기준으로 쓴다.

EC2도 현재 유효한 선택이다. EC2에 컨테이너와 CI를 붙일 수 있고 ECS도 EC2 기반 실행을 지원한다. **EC2에서 ECS로 바뀌는 것만이 현대화는 아니다.** 이 수업에서는 산출물·검사·실행 설정·버전 판정을 재현할 수 있게 남기는 차이를 설명한다. [ECS 실행 용량 선택](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/ecs-configuration.html), [AWS 불변 인프라 원칙](https://docs.aws.amazon.com/wellarchitected/latest/framework/rel_tracking_change_management_immutable_infrastructure.html)

## 운영자 로그인: 앱 계정·서버 접속·AWS API 신원

`demo-a`는 예약 앱의 사용자다. SSH 키는 EC2의 OS 접속에 쓰며, AWS CLI 자격은 AWS API 요청에 쓰인다. 한 로그인이 나머지 권한을 모두 주는 구조가 아니다.

AWS Console에 브라우저로 로그인한 상태를 로컬 CLI가 항상 자동으로 공유하는 것도 아니다. CLI에서 사용할 인증 경로와 이름 붙은 profile을 정한다. profile은 계정·역할·Region·인증 경로를 고르는 설정이며 권한을 만들어 주는 장치가 아니다.

| 현재 AWS 접속 경로 | 로컬 개발자의 인증 방식 | 준비할 것 |
|---|---|---|
| IAM 사용자 또는 IAM federation 기반 Console | `aws login` | AWS CLI v2 2.32.0 이상, Console 접근과 필요한 로그인 정책 |
| 조직의 IAM Identity Center 포털 | `aws configure sso` → `aws sso login` | 관리자가 준 포털 URL·SSO Region·할당 계정/역할 |
| GitHub Actions | OIDC → AWS STS → deploy role | OIDC provider·정확한 trust 조건·배포 정책 |

`aws login`은 실제 AWS CLI 명령이다. Console 세션을 선택하거나 브라우저로 인증해 임시 자격을 얻고 갱신하며, 공식 문서의 세션 범위는 최대 12시간이다. IAM 주체에는 `SignInLocalDevelopmentAccess` 등 로그인 허용 권한이 필요하다. 이 정책은 ECR push·ECS 배포·RDS 생성 권한을 추가하지 않는다. IAM Identity Center 사용자는 별도의 SSO 경로를 사용한다. 일상 개발·배포에는 root 대신 조직이 정한 최소 권한의 사람 신원을 사용한다. [Console 자격 로그인](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html), [로그인 정책](https://docs.aws.amazon.com/aws-managed-policy/latest/reference/SignInLocalDevelopmentAccess.html), [root 권고](https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html)

## 명령을 읽는 순서

다음은 **미실행 예시**다. 사용자의 계정 방식에 맞는 한 경로를 선택한다. `study-console`, `study-sso`는 예시 profile 이름이다.

### A. Console 기반 로그인

```bash
aws --version
aws login --profile study-console --region ap-northeast-2
aws sts get-caller-identity --profile study-console
```

CLI 버전을 확인하고 브라우저에서 사용할 AWS 신원을 선택한 뒤 `Account`와 `Arn`을 승인한 대상과 대조한다. 자격을 직접 복사하거나 긴 수명의 Access Key·Secret Key를 공유할 필요가 없는 로그인 경로다. 브라우저가 없는 원격 호스트에는 공식 `aws login --remote` 경로도 있지만 CI에 대화형 로그인으로 넣지는 않는다. [aws login](https://docs.aws.amazon.com/cli/latest/reference/login/)

### B. 조직 IAM Identity Center

```bash
aws configure sso --profile study-sso
aws sso login --profile study-sso
aws sts get-caller-identity --profile study-sso
```

첫 wizard에서 관리자가 제공한 start/issuer URL, Identity Center의 Region, 할당된 계정과 역할을 선택한다. 그 뒤에는 해당 profile로 SSO 로그인한다. **SSO Region은 인증 디렉터리가 있는 곳이고, 앱 배포 Region과 다를 수 있다.** 세션이 만료되면 다시 로그인한다. [SSO 설정과 로그인](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html)

`get-caller-identity`는 현재 신원을 확인한다. 별도 작업 권한 없이 호출할 수 있어 성공해도 Terraform apply나 ECR push 권한까지 확인한 것이 아니다. 실제 작업은 해당 IAM 정책과 대상 리소스의 권한으로 허용된다. [STS get-caller-identity](https://docs.aws.amazon.com/cli/latest/reference/sts/get-caller-identity.html)

### Terraform과 profile 연결

이 저장소의 AWS 스크립트는 `aws` CLI를 호출하므로 미래 실행 시 선택한 profile을 `AWS_PROFILE`로 전달할 수 있다. Terraform은 자체 SDK·공급자·backend 인증 경로를 사용하므로 **`aws login` 성공만으로 이 저장소의 Terraform 조합까지 호환된다고 단정하지 않는다.** AWS의 Console 자격 지원표는 SDK별로 다르다. [SDK 지원표](https://docs.aws.amazon.com/sdkref/latest/guide/feature-login-credentials.html)

조직에서 제공하는 SSO profile을 사용하거나, Console 로그인 경로라면 공식 `credential_process` 호환 방식을 검토한다. 아래 명령은 별도 도구 profile을 설정하는 **미실행 예시**다.

```bash
aws configure set credential_process "aws configure export-credentials --profile study-console --format process" --profile study-process
aws configure set region ap-northeast-2 --profile study-process
AWS_PROFILE=study-process terraform -chdir=infra/aws plan
```

이 방식은 Terraform이 필요할 때 CLI를 통해 자격을 받아 쓰게 한다. `export-credentials`를 발표 터미널에서 단독 실행하면 실제 임시 자격 JSON을 출력하므로 단독 실행·파일 저장·Git 공유 시연은 하지 않는다. 호환 방식과 실제 계정의 plan은 이 실습에서 검증하지 않았다. 기존 환경 자격이 개입해 다른 신원이 사용되는지 확인할 때도 비밀값을 출력하지 말고 같은 실행 경로의 신원 확인부터 한다. [공식 호환 경로](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sign-in.html#cli-configure-sign-in-process), [자격 출력 명령](https://docs.aws.amazon.com/cli/latest/reference/configure/export-credentials.html), [환경 설정 우선순위](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-envvars.html)

### 세션 종료와 AWS 자원 수명

Console 로그인 캐시는 `~/.aws/login/cache`, SSO 캐시는 `~/.aws/sso/cache`에 있다. 위치만 설명하며 실제 파일을 열거나 공유하지 않는다.

```bash
aws logout --profile study-console
aws sso logout
```

첫 명령은 지정한 Console login profile, 두 번째는 로컬의 모든 SSO profile에 걸친 캐시를 정리하는 명령이다. 로그아웃은 실행 중인 AWS 자원을 중지하거나 요금을 끝내지 않는다. [Console logout](https://docs.aws.amazon.com/cli/latest/reference/logout/), [SSO logout](https://docs.aws.amazon.com/cli/latest/reference/sso/logout.html)

## CI의 인증: GitHub OIDC

사람의 브라우저 로그인과 CI의 인증은 나눈다. 이 저장소는 `deploy.yml`의 `id-token: write`로 GitHub OIDC 토큰을 요청하고 AWS STS에서 제한된 deploy role의 임시 자격으로 교환하는 구조다. `id-token: write` 자체가 AWS 관리자 권한인 것은 아니다.

```text
GitHub workflow + production Environment
→ GitHub OIDC 토큰
→ AWS trust policy의 aud·정확한 sub 검사
→ STS 임시 deploy role 자격
→ permissions policy가 허용한 ECR·migration·ECS 작업
```

trust policy는 누가 그 역할을 맡을지, permissions policy는 맡은 뒤 무엇을 할지를 정한다. 반복 CI에는 master bootstrap role의 PassRole/RunTask를 주지 않는다. 승인자·배포 변수·OIDC provider·정확한 저장소 subject는 실계정/저장소에 별도로 구성해야 한다. 현재 설정을 실제 계정에 적용하거나 원격 workflow를 실행하지 않았다. [AWS GitHub OIDC 지침](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_create_for-idp_oidc.html#idp_oidc_Create_GitHub)

## 어느 단계부터 자원과 비용이 생기는가

| 단계 | 하는 일 | 비용과 실습 경계 |
|---|---|---|
| `./dev up / verify / demo` | 로컬 Docker 앱과 검사 | 이 작업에서 AWS 자원 생성 없음 |
| `./dev infra-check` | backend 없는 init·fmt·validate | AWS 운영 성공/계정 권한 검증 아님 |
| 사람 로그인·STS 신원 확인 | 사용할 계정·역할 확인 | EC2/ECS/RDS 생성 아님. 기존 AWS 자원의 요금은 계속될 수 있음 |
| 실계정 `terraform plan` | 현재 상태를 읽고 변경안 계산 | 리소스 변경을 실행하지 않음. 요금 견적서도 아님 |
| `terraform apply` | foundation 리소스 생성·변경 | NAT·ALB·RDS·공인 IPv4 등 유지 비용 경계가 생길 수 있음 |
| ECR push | 이미지 보관·전송 | 이미지 저장과 전송 조건에 따른 요금 확인 |
| bootstrap·migration·서비스 배포 | 일회성/상시 Fargate Task 실행 | 요청 자원 실행 시간, 로그·네트워크 등의 비용 확인 |

이 예제의 `desired_count = 0`은 최초 ECS 앱 Task를 아직 시작하지 않는다는 뜻이다. **NAT Gateway·ALB·RDS·공인 IPv4까지 무료라는 뜻은 아니다.** `apply`가 중간에 실패해도 이미 생성한 리소스가 자동으로 전부 사라지는 것은 아니다. 실제 배포 스크립트는 API/Web을 각각 1개 Task로 올리고 Terraform은 그 수를 `ignore_changes`하므로 다음 apply가 자동 종료 명령이 되지도 않는다. [Terraform plan](https://developer.hashicorp.com/terraform/cli/commands/plan), [apply](https://developer.hashicorp.com/terraform/cli/commands/apply), [NAT·IPv4](https://aws.amazon.com/vpc/pricing/), [ALB](https://aws.amazon.com/elasticloadbalancing/pricing/), [RDS](https://aws.amazon.com/rds/postgresql/pricing/), [ECR](https://aws.amazon.com/ecr/pricing/), [Fargate](https://aws.amazon.com/fargate/pricing/)

`./dev down`은 로컬 Compose를 내린다. AWS 로그아웃이나 EC2 한 대 중지도 전체 AWS 비용 종료가 아니다. EC2 중지 후 EBS·남은 공인 IP·스냅샷, RDS 중지 후 저장소·백업 등은 별도 수명과 비용을 갖는다. RDS 중지는 최대 7일 뒤 자동 시작하는 조건도 있다. 자원 정리는 소유 계정·Region·태그·의존성을 확인하고 보관할 DB/스냅샷을 결정한 뒤 검토한 대상만 수행한다. 이 예제의 DB 삭제 보호와 최종 스냅샷 설정을 무시하는 일괄 삭제 명령은 제공하지 않는다. [EC2 수명](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html), [RDS 중지](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_StopInstance.html)

금액은 Region·구성·사용량·계정의 무료 한도/크레딧에 따라 달라진다. 실계정 plan 전 비용을 산정하고, 생성 뒤 Billing과 잔존 자원을 확인한다. Budget 알림은 모든 과금을 즉시 차단하는 상한이 아니다. 현재 강의는 요금이 발생하는 AWS 운영 실습을 자동으로 시작하지 않는다. [AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html)

공식 자료 확인일: 2026-11-08. 실제 계정·로그인·provider/backend 호환·운영 배포는 미검증이다.
