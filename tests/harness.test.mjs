import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { sourceDigest } from "../scripts/lib/source-digest.mjs";
import { stopDecision } from "../scripts/lib/stop-policy.mjs";
import { spawnSync } from "node:child_process";
test("source change invalidates verification; private/generated files are excluded", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "study-harness-"));
  try {
    await fs.mkdir(`${root}/web/src`, { recursive: true });
    await fs.writeFile(`${root}/web/src/policy.ts`, "capacity=8");
    const a = await sourceDigest(root);
    await fs.mkdir(`${root}/.local`, { recursive: true });
    await fs.writeFile(`${root}/.local/runtime.env`, "FAKE_FIXTURE_ONLY=never-read");
    assert.equal(await sourceDigest(root), a);
    await fs.writeFile(`${root}/web/src/policy.ts`, "capacity=9");
    assert.notEqual(await sourceDigest(root), a);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("Stop blocks missing, failed or stale receipts and accepts a current successful receipt", () => {
  const state = { changed: true, digest: "new" };
  assert.equal(stopDecision(state).decision, "block");
  assert.equal(
    stopDecision({ ...state, receipt: { status: "failed", sourceDigest: "new" } }).decision,
    "block",
  );
  assert.equal(
    stopDecision({ ...state, receipt: { status: "passed", sourceDigest: "old" } }).decision,
    "block",
  );
  assert.deepEqual(
    stopDecision({ ...state, receipt: { status: "passed", sourceDigest: "new" } }),
    {},
  );
});
test("readonly stops and repeated stop hooks do not create an infinite loop", () => {
  assert.deepEqual(stopDecision({ changed: false }), {});
  assert.deepEqual(stopDecision({ changed: true, active: true }), {});
  const result = spawnSync(process.execPath, [path.resolve("scripts/agent-stop-check.mjs")], {
    cwd: os.tmpdir(),
    input: JSON.stringify({ stop_hook_active: true }),
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {});
});
test("image build exclusions invalidate receipts; JSON-RPC errors never count as MCP success", async () => {
  const { initializeResult } = await import("../scripts/lib/mcp-response.mjs");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "study-build-input-"));
  try {
    await fs.mkdir(`${root}/api`);
    const a = await sourceDigest(root);
    await fs.writeFile(`${root}/api/.dockerignore`, "src/");
    assert.notEqual(await sourceDigest(root), a);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
  assert.throws(() =>
    initializeResult(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32602, message: "Unsupported protocolVersion" },
      }),
    ),
  );
  const result = {
    protocolVersion: "2025-03-26",
    capabilities: {},
    serverInfo: { name: "test", version: "1" },
  };
  assert.deepEqual(
    initializeResult(
      `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result })}\n\n`,
    ),
    result,
  );
});
