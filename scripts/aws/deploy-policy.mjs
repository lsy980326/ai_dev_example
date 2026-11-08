export function successfulJob(result) {
  return (
    result.tasks?.length === 1 &&
    result.tasks[0].lastStatus === "STOPPED" &&
    result.tasks[0].containers?.some((c) => c.name === "api" && c.exitCode === 0) &&
    !result.tasks[0].containers.some((c) => c.exitCode !== undefined && c.exitCode !== 0)
  );
}
export function deployedRevision(result, revision) {
  const service = result.services?.[0];
  return (
    !result.failures?.length &&
    service?.taskDefinition === revision &&
    service.runningCount === service.desiredCount &&
    service.desiredCount > 0 &&
    service.deployments?.length === 1 &&
    service.deployments[0].rolloutState === "COMPLETED"
  );
}
