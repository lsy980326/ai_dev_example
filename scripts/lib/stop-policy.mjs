export function stopDecision({ active, changed, digest, receipt }) {
  if (active || !changed) return {};
  if (receipt?.status === "passed" && receipt.sourceDigest === digest) return {};
  return {
    decision: "block",
    reason:
      "Changed source has no matching successful verification. Run ./dev verify, fix failures, then inspect ./dev status. A hook is advisory; CI remains required.",
  };
}
