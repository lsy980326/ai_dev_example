import test from "node:test";
import assert from "node:assert/strict";
import { successfulJob, deployedRevision } from "../scripts/aws/deploy-policy.mjs";
import { validateReleaseSource } from "../scripts/aws/release-policy.mjs";
test("stopped migration is not necessarily successful", () => {
  assert.equal(
    successfulJob({
      tasks: [{ lastStatus: "STOPPED", containers: [{ name: "api", exitCode: 1 }] }],
    }),
    false,
  );
  assert.equal(successfulJob({ tasks: [{ lastStatus: "STOPPED", containers: [] }] }), false);
  assert.equal(
    successfulJob({
      tasks: [{ lastStatus: "STOPPED", containers: [{ name: "api", exitCode: 0 }] }],
    }),
    true,
  );
});
test("immutable image tags identify the exact committed source", () => {
  const sha = "a".repeat(40);
  assert.doesNotThrow(() => validateReleaseSource({ sha, head: sha, dirty: false }));
  assert.throws(() => validateReleaseSource({ sha, head: "b".repeat(40), dirty: false }));
  assert.throws(() => validateReleaseSource({ sha, head: sha, dirty: true }));
});
test("a stable old revision after rollback is not a successful release", () => {
  const services = [
    {
      taskDefinition: "old",
      runningCount: 1,
      desiredCount: 1,
      deployments: [{ rolloutState: "COMPLETED" }],
    },
  ];
  assert.equal(deployedRevision({ services }, "new"), false);
  assert.equal(deployedRevision({ services }, "old"), true);
  services[0].deployments[0].rolloutState = "IN_PROGRESS";
  assert.equal(deployedRevision({ services }, "old"), false);
});
