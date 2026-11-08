import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
// Invoked explicitly by a future AWS operator, never by CI or local ./dev up.
if (!process.argv.includes("--confirm-aws-changes"))
  throw new Error("Explicit --confirm-aws-changes required. Read docs/aws.md first.");
const config = JSON.parse(await fs.readFile(".local/aws/deploy-config.json", "utf8"));
const clientFile = process.env.OIDC_CLIENT_SECRET_FILE;
if (!clientFile)
  throw new Error(
    "Provide OIDC_CLIENT_SECRET_FILE pointing to a restricted file supplied by your identity administrator.",
  );
const client = (await fs.readFile(clientFile, "utf8")).trim();
if (client.length < 16) throw new Error("OIDC client secret too short");
await fs.mkdir(".local/aws/secrets", { recursive: true, mode: 0o700 });
for (const key of ["app-db", "migrator-db", "web-session", "oidc-client"]) {
  const arn = config.secret_arns[key];
  const existing = spawnSync(
    "aws",
    [
      "secretsmanager",
      "list-secret-version-ids",
      "--secret-id",
      arn,
      "--region",
      config.region,
      "--output",
      "json",
    ],
    { encoding: "utf8" },
  );
  if (existing.status !== 0) throw new Error("Unable to check secret metadata");
  if (JSON.parse(existing.stdout).Versions?.length)
    throw new Error(
      `Refusing to replace existing ${key}; rotation needs a separate DB/session migration plan.`,
    );
}
for (const key of ["app-db", "migrator-db", "web-session", "oidc-client"]) {
  const file = `.local/aws/secrets/${key}`;
  await fs.writeFile(file, key === "oidc-client" ? client : randomBytes(32).toString("hex"), {
    mode: 0o600,
  });
  try {
    const result = spawnSync(
      "aws",
      [
        "secretsmanager",
        "put-secret-value",
        "--secret-id",
        config.secret_arns[key],
        "--secret-string",
        `file://${file}`,
        "--region",
        config.region,
      ],
      { stdio: "ignore" },
    );
    if (result.status !== 0)
      throw new Error(`Secret write failed for ${key}; inspect version metadata before retrying.`);
  } finally {
    await fs.rm(file, { force: true });
  }
}
console.log(
  "Four initial secret versions created without logging values. Run the one-time bootstrap with an operator identity, then routine release.",
);
