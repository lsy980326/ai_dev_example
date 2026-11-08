import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { apiIdentity } from "@/lib/auth";
import { serverConfig } from "@/lib/server-config";
import { isEmptyRegistrationBody, validateMutationRequest } from "@/lib/mutation-policy";

const error = (status: number, code: string, message: string) =>
  NextResponse.json({ code, message }, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const config = serverConfig();
  const policy = validateMutationRequest(
    request.headers.get("origin"),
    request.headers.get("content-type"),
    config.appOrigin,
  );
  if (!policy.ok) return error(policy.status, policy.code, "요청 출처와 형식을 확인해 주세요.");
  const identity = await apiIdentity(request);
  if (!identity) return error(401, "UNAUTHENTICATED", "다시 로그인한 뒤 신청해 주세요.");
  const { id } = await params;
  if (!/^[1-9]\d{0,14}$/.test(id))
    return error(400, "INVALID_REQUEST", "모임 번호를 확인해 주세요.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error(400, "INVALID_REQUEST", "요청 형식을 확인해 주세요.");
  }
  if (!isEmptyRegistrationBody(body))
    return error(400, "INVALID_REQUEST", "신청 요청에는 회원 정보를 보내지 않습니다.");
  const requestId = randomUUID();
  try {
    const upstream = await fetch(`${config.apiBase}/sessions/${id}/registrations`, {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${identity.accessToken}`,
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      body: "{}",
    });
    if (![200, 201, 400, 401, 403, 404, 409].includes(upstream.status))
      return error(
        502,
        "API_UNAVAILABLE",
        "신청 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    const data: unknown = await upstream.json();
    return NextResponse.json(data, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store", "X-Request-ID": requestId },
    });
  } catch {
    return error(
      502,
      "RESULT_UNKNOWN",
      "응답을 확인하지 못했습니다. 다시 시도하면 이미 확정된 신청을 확인할 수 있습니다.",
    );
  }
}
