import { describe, expect, it } from "vitest";
import { parseServerConfig } from "./config-policy";
const config = {
  APP_MODE: "production",
  APP_ORIGIN: "https://study.example.test",
  OIDC_ISSUER: "https://login.example.test/realms/study",
  NEXTAUTH_SECRET: "public-test-session-secret-not-a-real-credential",
  OIDC_DISCOVERY_URL: "https://login.example.test/realms/study/.well-known/openid-configuration",
  OIDC_CLIENT_ID: "study-web",
  OIDC_CLIENT_SECRET: "public-test-client-secret",
  API_BASE_URL: "http://study-api:8080",
};
describe("runtime auth transport", () => {
  it("allows HTTPS auth with private internal API", () => {
    expect(parseServerConfig(config).apiBase).toBe("http://study-api:8080");
  });
  it("rejects HTTP discovery in production", () => {
    expect(() =>
      parseServerConfig({
        ...config,
        OIDC_DISCOVERY_URL: "http://identity:8080/realms/study/.well-known/openid-configuration",
      }),
    ).toThrow();
  });
  it("allows explicit local public issuer and internal discovery", () => {
    expect(
      parseServerConfig({
        ...config,
        APP_MODE: "local",
        APP_ORIGIN: "http://localhost:3000",
        OIDC_ISSUER: "http://localhost:18080/realms/study",
        OIDC_DISCOVERY_URL: "http://identity:8080/realms/study/.well-known/openid-configuration",
      }).discovery,
    ).toContain("identity:8080");
  });
  it.each([
    { APP_ORIGIN: "http://study.example.test" },
    { OIDC_ISSUER: "http://login.example.test" },
    { APP_MODE: undefined },
    { NEXTAUTH_SECRET: "short" },
    { APP_ORIGIN: "https://study.example.test/path" },
  ])("rejects unsafe or missing auth configuration", (change) => {
    expect(() => parseServerConfig({ ...config, ...change })).toThrow();
  });
});
