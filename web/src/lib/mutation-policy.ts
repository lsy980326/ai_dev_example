export type MutationPolicy = { ok: true } | { ok: false; status: number; code: string };
export function isEmptyRegistrationBody(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    !Array.isArray(body) &&
    Object.keys(body).length === 0
  );
}

export function validateMutationRequest(
  origin: string | null,
  contentType: string | null,
  appOrigin: string,
): MutationPolicy {
  if (origin !== appOrigin) return { ok: false, status: 403, code: "ORIGIN_REJECTED" };
  if (contentType?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json")
    return { ok: false, status: 415, code: "JSON_REQUIRED" };
  return { ok: true };
}
