export function parseServerConfig(input: Record<string, string | undefined>) {
  const required = (name: string) => {
    const value = input[name];
    if (!value) throw new Error(`Missing server configuration: ${name}`);
    return value;
  };
  const appOrigin = required("APP_ORIGIN"),
    issuer = required("OIDC_ISSUER"),
    secret = required("NEXTAUTH_SECRET");
  if (new URL(appOrigin).origin !== appOrigin || secret.length < 32)
    throw new Error("Invalid origin or session secret");
  if (input.APP_MODE !== "local" && input.APP_MODE !== "production")
    throw new Error("APP_MODE must be explicit");
  const discovery = required("OIDC_DISCOVERY_URL");
  const issuerUrl = new URL(issuer),
    discoveryUrl = new URL(discovery);
  if (
    input.APP_MODE === "production" &&
    (!appOrigin.startsWith("https://") ||
      issuerUrl.protocol !== "https:" ||
      discoveryUrl.protocol !== "https:")
  )
    throw new Error("Production auth and discovery require HTTPS");
  return {
    appOrigin,
    issuer,
    secret,
    discovery,
    clientId: required("OIDC_CLIENT_ID"),
    clientSecret: required("OIDC_CLIENT_SECRET"),
    apiBase: required("API_BASE_URL"),
  };
}
