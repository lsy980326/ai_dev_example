import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { sourceDigest } from "./lib/source-digest.mjs";
const action = process.argv[2],
  dir = ".local/verification";
await fs.mkdir(dir, { recursive: true });
const read = async (name) => JSON.parse(await fs.readFile(`${dir}/${name}.json`, "utf8"));
const digest = await sourceDigest();
const write = async (name, data) =>
  fs.writeFile(`${dir}/${name}.json`, JSON.stringify(data, null, 2) + "\n");
if (action === "start-e2e")
  await write("e2e-start", { sourceDigest: digest, startedAt: new Date().toISOString() });
else if (action === "finish-e2e") {
  const start = await read("e2e-start"),
    report = JSON.parse(await fs.readFile(".local/e2e/results.json", "utf8"));
  assert.equal(start.sourceDigest, digest, "Source changed during browser tests");
  assert.ok(Date.parse(report.stats.startTime) >= Date.parse(start.startedAt));
  assert.equal(report.stats.unexpected, 0);
  assert.equal(report.stats.skipped, 0);
  assert.equal(report.stats.expected, 2);
  await write("e2e", {
    status: "passed",
    sourceDigest: digest,
    checkedAt: new Date().toISOString(),
    tests: 2,
  });
} else if (action === "infra")
  await write("infra", {
    status: "passed",
    sourceDigest: digest,
    checkedAt: new Date().toISOString(),
    scope: "Terraform init -backend=false, fmt -check, validate; no AWS plan/apply",
  });
else if (action === "complete") {
  const parts = await Promise.all(["unit", "e2e", "infra"].map(read));
  for (const part of parts) {
    assert.equal(part.status, "passed");
    assert.equal(part.sourceDigest, digest, "Stale verification receipt");
  }
  await write("latest", {
    status: "passed",
    sourceDigest: digest,
    checkedAt: new Date().toISOString(),
    checks: parts,
  });
  console.log("Full verification passed. ./dev status displays the sanitized result.");
} else if (action === "status") {
  try {
    const receipt = await read("latest");
    console.log(
      JSON.stringify(
        {
          status: receipt.sourceDigest === digest ? receipt.status : "stale",
          checkedAt: receipt.checkedAt,
          sourceDigest: receipt.sourceDigest,
          currentSourceDigest: digest,
          checks: receipt.checks?.map((p) => ({
            status: p.status,
            scope: p.scope,
            tests: p.tests,
            checkedAt: p.checkedAt,
          })),
        },
        null,
        2,
      ),
    );
  } catch {
    console.log("No complete verification receipt. Run ./dev verify.");
  }
} else throw new Error("Unknown receipt action");
