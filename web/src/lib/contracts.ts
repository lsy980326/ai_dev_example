export type StudySession = {
  id: number;
  title: string;
  description: string;
  startsAt: string;
  closesAt: string;
  capacity: number;
  registeredCount: number;
  registrationOpen: boolean;
  myRegistrationId: number | null;
};
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function isSession(v: unknown): v is StudySession {
  if (!isRecord(v)) return false;
  return (
    Number.isSafeInteger(v.id) &&
    typeof v.id === "number" &&
    v.id > 0 &&
    typeof v.title === "string" &&
    typeof v.description === "string" &&
    typeof v.startsAt === "string" &&
    Number.isFinite(Date.parse(v.startsAt)) &&
    typeof v.closesAt === "string" &&
    Number.isFinite(Date.parse(v.closesAt)) &&
    typeof v.capacity === "number" &&
    Number.isSafeInteger(v.capacity) &&
    v.capacity > 0 &&
    v.capacity <= 200 &&
    typeof v.registeredCount === "number" &&
    Number.isSafeInteger(v.registeredCount) &&
    v.registeredCount >= 0 &&
    v.registeredCount <= v.capacity &&
    typeof v.registrationOpen === "boolean" &&
    (v.myRegistrationId === null ||
      (typeof v.myRegistrationId === "number" &&
        Number.isSafeInteger(v.myRegistrationId) &&
        v.myRegistrationId > 0))
  );
}
export function parseSessions(value: unknown): StudySession[] {
  if (!Array.isArray(value) || value.length > 50 || !value.every(isSession))
    throw new Error("INVALID_API_RESPONSE");
  return value;
}
