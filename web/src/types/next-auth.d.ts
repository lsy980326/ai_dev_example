import type { DefaultSession } from "next-auth";
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
    reauthRequired: boolean;
  }
}
declare module "next-auth/jwt" {
  interface JWT {
    apiAccessToken?: string;
    apiAccessTokenExpiresAt?: number;
  }
}
