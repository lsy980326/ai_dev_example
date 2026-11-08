import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { sourceDigest } from "./lib/source-digest.mjs";
const digest = await sourceDigest(),
  startedAt = new Date().toISOString(),
  commands = [];
await fs.mkdir(".local/verification", { recursive: true });
await fs.rm(".local/verification/latest.json", { force: true });
function run(command, args, cwd = ".") {
  console.log(`\n> (${cwd}) ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  });
  if (result.status !== 0) throw new Error(`Verification failed: ${command} ${args.join(" ")}`);
  commands.push({ command: [command, ...args].join(" "), cwd, status: "passed" });
}
run("npm", ["ci"], "web");
run("npm", ["audit", "--audit-level=moderate"], "web");
for (const name of ["typecheck", "lint", "test", "build"]) run("npm", ["run", name], "web");
run("./gradlew", ["test", "--rerun-tasks", "--no-daemon", "--console=plain"], "api");
run("node", ["scripts/defect-demo.mjs"]);
run("node", ["--test", "tests/harness.test.mjs", "tests/deploy-policy.test.mjs"]);
run("node", ["scripts/skill-check.mjs"]);
const map = JSON.parse(await fs.readFile("docs/slides-map.json", "utf8"));
for (const entry of map) for (const file of entry.files) await fs.access(file);
if ((await sourceDigest()) !== digest)
  throw new Error("Source changed during verification. Run again after edits finish.");
await fs.writeFile(
  ".local/verification/unit.json",
  JSON.stringify(
    {
      status: "passed",
      sourceDigest: digest,
      startedAt,
      checkedAt: new Date().toISOString(),
      commands,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Code, PostgreSQL, counterexample, harness and teaching path checks passed. Browser and infrastructure checks follow in ./dev verify.",
);
