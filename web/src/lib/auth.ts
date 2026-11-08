import "server-only";
import type { NextAuthOptions } from "next-auth";
import KeycloakProvider from "next-auth/providers/keycloak";
import { getToken } from "next-auth/jwt";
import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { serverConfig } from "./server-config";

export function authOptions(): NextAuthOptions {
  const config = serverConfig();
  return {
    secret: config.secret,
    session: { strategy: "jwt", maxAge: 300 },
    providers: [
      KeycloakProvider({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        issuer: config.issuer,
        wellKnown: config.discovery,
        checks: ["pkce", "state"],
        authorization: { params: { scope: "openid profile registration:write" } },
      }),
    ],
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          token.apiAccessToken = account.access_token;
          token.apiAccessTokenExpiresAt = (account.expires_at ?? 0) * 1000;
        }
        return token;
      },
      async session({ session, token }) {
        // /api/auth/session is public to browser JavaScript: explicitly whitelist display fields.
        return {
          expires: session.expires,
          user: { id: token.sub ?? "", name: token.name ?? "참가자" },
          reauthRequired:
            !token.apiAccessTokenExpiresAt || Date.now() >= token.apiAccessTokenExpiresAt,
        };
      },
    },
    logger: {
      error(code) {
        console.error("auth_error", code);
      },
      warn(code) {
        console.warn("auth_warning", code);
      },
      debug() {},
    },
  };
}
export type ApiIdentity = { subject: string; name: string; accessToken: string };
export async function apiIdentity(request?: NextRequest): Promise<ApiIdentity | null> {
  const config = serverConfig();
  // Constructing a request reads cookies in SSR; it does not perform a self-HTTP request.
  const req = request ?? new NextRequest(config.appOrigin, { headers: await headers() });
  const token = await getToken({
    req,
    secret: config.secret,
    secureCookie: config.appOrigin.startsWith("https://"),
  });
  if (
    !token?.sub ||
    !token.apiAccessToken ||
    !token.apiAccessTokenExpiresAt ||
    Date.now() >= token.apiAccessTokenExpiresAt
  )
    return null;
  return { subject: token.sub, name: token.name ?? "참가자", accessToken: token.apiAccessToken };
}
