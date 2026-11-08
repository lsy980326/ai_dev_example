import { describe, expect, it } from "vitest";
import { validateMutationRequest, isEmptyRegistrationBody } from "./mutation-policy";

describe("reservation BFF mutation boundary", () => {
  it("accepts only the configured origin and JSON", () => {
    expect(
      validateMutationRequest(
        "https://study.example",
        "application/json; charset=utf-8",
        "https://study.example",
      ),
    ).toEqual({ ok: true });
  });
  it.each([
    null,
    "https://evil.example",
    "https://study.example.evil.test",
    "http://study.example",
    "null",
  ])("rejects missing or foreign origin %s", (origin) => {
    expect(validateMutationRequest(origin, "application/json", "https://study.example")).toEqual({
      ok: false,
      status: 403,
      code: "ORIGIN_REJECTED",
    });
  });
  it.each([null, "text/plain", "application/x-www-form-urlencoded", "application/jsonp"])(
    "rejects non-JSON body %s",
    (contentType) => {
      expect(
        validateMutationRequest("https://study.example", contentType, "https://study.example"),
      ).toEqual({ ok: false, status: 415, code: "JSON_REQUIRED" });
    },
  );
});
describe("registration body", () => {
  it("accepts an empty object", () => {
    expect(isEmptyRegistrationBody({})).toBe(true);
  });
  it.each([null, [], "", { memberId: "victim" }, { sessionId: 99 }])(
    "rejects identity and unexpected input",
    (value) => {
      expect(isEmptyRegistrationBody(value)).toBe(false);
    },
  );
});
