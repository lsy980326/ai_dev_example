import fs from "node:fs/promises";
import readline from "node:readline/promises";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
try {
  console.log(
    "AWS 비용이 발생하는 apply는 실행하지 않습니다. 소유한 DNS·OIDC·GitHub 값만 묻습니다. 비밀번호를 입력하지 마세요.",
  );
  const fields = {
    region: "AWS region [ap-northeast-2]",
    name: "Resource name [study]",
    zone_id: "Owned Route53 zone ID",
    domain: "Owned app domain (study.example.com)",
    oidc_issuer: "HTTPS OIDC issuer",
    oidc_discovery_url: "HTTPS OIDC discovery URL",
    oidc_jwks_uri: "HTTPS OIDC JWKS URI",
    oidc_client_id: "OIDC client ID",
    github_oidc_provider_arn: "Existing GitHub IAM OIDC provider ARN",
    github_oidc_subject: "Exact GitHub OIDC subject ending :environment:production",
  };
  const config = {};
  for (const [key, label] of Object.entries(fields)) {
    config[key] =
      (await rl.question(`${label}: `)).trim() ||
      ({ region: "ap-northeast-2", name: "study" }[key] ?? "");
    if (!config[key]) throw new Error(`${key} is required`);
  }
  const file = "infra/aws/local.auto.tfvars";
  try {
    await fs.access(file);
    throw new Error("Configuration already exists; review it instead of overwriting.");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  await fs.writeFile(
    file,
    Object.entries(config)
      .map(([k, v]) => `${k} = ${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
  console.log(
    "Ignored local Terraform inputs created. Follow docs/aws.md for reviewed plan, apply, secret seeding and first release. No AWS calls were made.",
  );
} finally {
  rl.close();
}
