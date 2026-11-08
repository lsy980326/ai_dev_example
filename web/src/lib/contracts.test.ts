import { describe, expect, it } from "vitest";
import { parseSessions } from "./contracts";
const session = {
  id: 17,
  title: "설계 스터디",
  description: "함께 설계합니다.",
  startsAt: "2026-11-08T12:00:00Z",
  closesAt: "2026-11-08T11:00:00Z",
  capacity: 8,
  registeredCount: 7,
  registrationOpen: true,
  myRegistrationId: null,
};
describe("Spring response boundary", () => {
  it("accepts a session with one seat left", () => {
    expect(parseSessions([session])[0].registeredCount).toBe(7);
  });
  it("retains the authenticated member's registration", () => {
    expect(parseSessions([{ ...session, myRegistrationId: 351 }])[0].myRegistrationId).toBe(351);
  });
  it.each([
    null,
    {},
    [{ ...session, capacity: 0 }],
    [{ ...session, registeredCount: 9 }],
    [{ ...session, startsAt: "invalid" }],
    [{ ...session, myRegistrationId: "victim" }],
  ])("rejects malformed or impossible API data", (v) => {
    expect(() => parseSessions(v)).toThrow();
  });
});
