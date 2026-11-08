import { apiIdentity } from "@/lib/auth";
import { loadSessions } from "@/lib/study-api";
import { StudyBoard } from "@/components/study-board";
import type { StudySession } from "@/lib/contracts";
export const dynamic = "force-dynamic";
export default async function Page() {
  const identity = await apiIdentity();
  let sessions: StudySession[] = [];
  let loadError = false;
  try {
    sessions = await loadSessions(identity);
  } catch {
    loadError = true;
  }
  return (
    <StudyBoard sessions={sessions} viewerName={identity?.name ?? null} loadError={loadError} />
  );
}
