import fs from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { sourceDigest } from "./lib/source-digest.mjs";
import { stopDecision } from "./lib/stop-policy.mjs";
let event = {};
try {
  event = JSON.parse(
    await new Promise((resolve) => {
      let s = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (x) => (s += x));
      process.stdin.on("end", () => resolve(s || "{}"));
    }),
  );
} catch {}
if (event.stop_hook_active) {
  console.log("{}");
  process.exit(0);
}
let receipt;
try {
  receipt = JSON.parse(await fs.readFile(".local/verification/latest.json", "utf8"));
} catch {}
try {
  const changed = process.env.STUDY_SOURCE_CHANGED
    ? Number(process.env.STUDY_SOURCE_CHANGED) > 0
    : execFileSync("git", ["status", "--porcelain", "--untracked-files=normal"], {
        encoding: "utf8",
      }).trim().length > 0;
  console.log(
    JSON.stringify(
      stopDecision({
        active: event.stop_hook_active,
        changed,
        digest: await sourceDigest(),
        receipt,
      }),
    ),
  );
} catch {
  console.log(
    JSON.stringify({
      decision: "block",
      reason:
        "Verification receipt could not be checked. Run ./dev verify and inspect ./dev status.",
    }),
  );
}
