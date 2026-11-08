import NextAuth from "next-auth";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
type Context = { params: Promise<{ nextauth: string[] }> };
async function handler(request: NextRequest, context: Context): Promise<Response> {
  return NextAuth(authOptions())(request, context);
}
export { handler as GET, handler as POST };
