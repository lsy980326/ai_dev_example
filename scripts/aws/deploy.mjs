import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { successfulJob, deployedRevision } from "./deploy-policy.mjs";
const config = JSON.parse(
  await fs.readFile(process.env.DEPLOY_CONFIG ?? ".local/aws/deploy-config.json", "utf8"),
);
const bootstrap = process.argv.includes("--bootstrap-only");
if (!process.argv.includes("--confirm-aws-changes"))
  throw new Error(
    "This command changes AWS resources. Read docs/aws.md, then pass --confirm-aws-changes explicitly.",
  );
const sha = process.env.RELEASE_SHA;
if (!/^[a-f0-9]{40}$/.test(sha ?? ""))
  throw new Error("RELEASE_SHA must be the full tested Git commit SHA.");
function aws(args) {
  const r = spawnSync("aws", [...args, "--region", config.region, "--output", "json"], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  if (r.status !== 0)
    throw new Error(
      `AWS command failed: ${args.slice(0, 2).join(" ")}. Inspect AWS/CloudWatch diagnostics; secret values are not printed here.`,
    );
  return r.stdout.trim() ? JSON.parse(r.stdout) : {};
}
const definitions = {};
for (const name of bootstrap ? ["bootstrap"] : ["migration", "api", "web"]) {
  const repo = config.repositories[name === "web" ? "web" : "api"];
  const image = aws([
    "ecr",
    "describe-images",
    "--repository-name",
    repo.split("/").slice(1).join("/"),
    "--image-ids",
    `imageTag=${sha}`,
  ]).imageDetails?.[0]?.imageDigest;
  if (!/^sha256:[a-f0-9]{64}$/.test(image ?? ""))
    throw new Error("Expected immutable ECR image digest");
  const original = aws([
    "ecs",
    "describe-task-definition",
    "--task-definition",
    config.tasks[name],
  ]).taskDefinition;
  const allowed = [
    "family",
    "taskRoleArn",
    "executionRoleArn",
    "networkMode",
    "containerDefinitions",
    "volumes",
    "placementConstraints",
    "requiresCompatibilities",
    "cpu",
    "memory",
    "runtimePlatform",
    "ephemeralStorage",
  ];
  const input = Object.fromEntries(
    allowed.filter((k) => original[k] !== undefined).map((k) => [k, original[k]]),
  );
  input.containerDefinitions[0].image = `${repo}@${image}`;
  // The definition includes secret ARNs only, never secret values.
  await fs.mkdir(".local/aws", { recursive: true });
  await fs.writeFile(`.local/aws/${name}-task.json`, JSON.stringify(input), { mode: 0o600 });
  definitions[name] = aws([
    "ecs",
    "register-task-definition",
    "--cli-input-json",
    `file://.local/aws/${name}-task.json`,
  ]).taskDefinition.taskDefinitionArn;
}
const job = bootstrap ? "bootstrap" : "migration";
const network = {
  awsvpcConfiguration: {
    subnets: config.subnets,
    securityGroups: [config.api_security_group],
    assignPublicIp: "DISABLED",
  },
};
const run = aws([
  "ecs",
  "run-task",
  "--cluster",
  config.cluster,
  "--launch-type",
  "FARGATE",
  "--platform-version",
  "1.4.0",
  "--task-definition",
  definitions[job],
  "--network-configuration",
  JSON.stringify(network),
]);
if (run.failures?.length || run.tasks?.length !== 1) throw new Error(`${job} could not start`);
const arn = run.tasks[0].taskArn;
aws(["ecs", "wait", "tasks-stopped", "--cluster", config.cluster, "--tasks", arn]);
if (!successfulJob(aws(["ecs", "describe-tasks", "--cluster", config.cluster, "--tasks", arn])))
  throw new Error(`${job} failed. Services were not updated.`);
if (bootstrap) {
  console.log("Bootstrap completed. Routine CI cannot assume the bootstrap execution role.");
  process.exit(0);
}
for (const name of ["api", "web"]) {
  aws([
    "ecs",
    "update-service",
    "--cluster",
    config.cluster,
    "--service",
    config.services[name],
    "--task-definition",
    definitions[name],
    "--desired-count",
    "1",
  ]);
  aws([
    "ecs",
    "wait",
    "services-stable",
    "--cluster",
    config.cluster,
    "--services",
    config.services[name],
  ]);
  if (
    !deployedRevision(
      aws([
        "ecs",
        "describe-services",
        "--cluster",
        config.cluster,
        "--services",
        config.services[name],
      ]),
      definitions[name],
    )
  )
    throw new Error(`${name} did not reach the expected revision; it may have rolled back.`);
}
for (const url of [`${config.app_url}/api/health`, `${config.api_url}/sessions`]) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error("Public smoke test failed");
}
console.log(
  `Released ${sha}: migration exit 0, exact API/Web revisions stable, public smoke tests passed.`,
);
