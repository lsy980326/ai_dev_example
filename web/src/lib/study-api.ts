import "server-only";
import { randomUUID } from "node:crypto";
import { parseSessions, type StudySession } from "./contracts";
import { serverConfig } from "./server-config";
import type { ApiIdentity } from "./auth";

export async function loadSessions(identity: ApiIdentity | null): Promise<StudySession[]> {
  const config = serverConfig();
  const response = await fetch(`${config.apiBase}/sessions`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
    headers: {
      "X-Request-ID": randomUUID(),
      ...(identity ? { Authorization: `Bearer ${identity.accessToken}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`API_READ_${response.status}`);
  const body: unknown = await response.json();
  return parseSessions(body);
}
