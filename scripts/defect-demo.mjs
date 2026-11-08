import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
await fs.rm("api/build/test-results/defectExperiment", { recursive: true, force: true });
const result = spawnSync(
  "./gradlew",
  ["defectExperiment", "--rerun-tasks", "--no-daemon", "--console=plain"],
  { cwd: "api", stdio: "inherit" },
);
const directory = "api/build/test-results/defectExperiment";
const files = await fs.readdir(directory).catch(() => []);
const xml = (
  await Promise.all(
    files.filter((x) => x.endsWith(".xml")).map((x) => fs.readFile(`${directory}/${x}`, "utf8")),
  )
).join("");
if (
  result.status === 0 ||
  !xml.includes("CAPACITY_INVARIANT") ||
  !xml.includes("but was: &lt;9&gt;") ||
  !/failures="1"/.test(xml) ||
  !/tests="1"/.test(xml)
)
  throw new Error(
    "Expected exactly one capacity assertion failure (8 vs 9). Build, infrastructure or other failures do not count.",
  );
console.log(
  "COUNTEREXAMPLE CONFIRMED: both transactions read 7, then 9 registrations were confirmed. The capacity assertion rejected the unsafe implementation. The production API is unchanged.",
);
