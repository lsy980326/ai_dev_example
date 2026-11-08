"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import type { StudySession } from "@/lib/contracts";

type State = {
  kind: "idle" | "pending" | "success" | "full" | "closed" | "auth" | "unknown";
  message: string;
  registrationId?: number;
};
const initial: State = { kind: "idle", message: "" };
const date = (value: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", ...options }).format(new Date(value));
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function login() {
  void signIn("keycloak", { callbackUrl: "/" }, { prompt: "login" });
}

export function StudyBoard({
  sessions,
  viewerName,
  loadError = false,
}: {
  sessions: StudySession[];
  viewerName: string | null;
  loadError?: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(17);
  const [state, setState] = useState<State>(initial);
  const [refreshing, startRefresh] = useTransition();
  const session = sessions.find((s) => s.id === selected) ?? sessions[0];
  const refresh = () => startRefresh(() => router.refresh());
  const mine =
    session?.myRegistrationId ?? (state.kind === "success" ? state.registrationId : null);
  const remaining = session ? Math.max(0, session.capacity - session.registeredCount) : 0;
  const isFull = session && (state.kind === "full" || remaining === 0);
  const isClosed = session && (state.kind === "closed" || (!session.registrationOpen && !isFull));
  async function register() {
    if (!session || state.kind === "pending") return;
    if (!viewerName || state.kind === "auth") {
      login();
      return;
    }
    setState({ kind: "pending", message: "신청을 확인하고 있어요." });
    try {
      const response = await fetch(`/api/sessions/${session.id}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data: unknown = await response.json();
      if (
        (response.status === 200 || response.status === 201) &&
        isRecord(data) &&
        typeof data.registrationId === "number"
      ) {
        setState({
          kind: "success",
          message:
            response.status === 201
              ? "참가 신청이 확정됐어요. 모임에서 만나요."
              : "이미 확정된 신청을 확인했어요.",
          registrationId: data.registrationId,
        });
        refresh();
      } else if (response.status === 401) {
        setState({
          kind: "auth",
          message: "로그인이 만료됐어요. 다시 로그인하면 신청을 이어갈 수 있어요.",
        });
      } else if (response.status === 409 && isRecord(data) && data.code === "SESSION_FULL") {
        setState({
          kind: "full",
          message: "마지막 자리가 먼저 확정됐어요. 다른 모임도 확인해 주세요.",
        });
        refresh();
      } else if (response.status === 409 && isRecord(data) && data.code === "REGISTRATION_CLOSED") {
        setState({ kind: "closed", message: "신청이 마감됐어요. 다음 모임에서 만나요." });
        refresh();
      } else {
        setState({
          kind: "unknown",
          message:
            "신청 결과를 확인하지 못했어요. 다시 시도해 주세요. 이미 확정됐다면 같은 신청을 확인합니다.",
        });
      }
    } catch {
      setState({
        kind: "unknown",
        message:
          "연결이 끊겨 결과를 확인하지 못했어요. 다시 시도하면 이미 확정된 신청도 확인할 수 있어요.",
      });
    }
  }
  return (
    <>
      <header className="site-header page-shell">
        <Link className="wordmark" href="/">
          다음 모임
          <span className="wordmark-dot" aria-hidden="true" />
        </Link>
        <nav aria-label="사용자 메뉴">
          {viewerName ? (
            <>
              <span className="viewer-name">{viewerName}님</span>
              <button className="text-button" onClick={() => void signOut({ callbackUrl: "/" })}>
                로그아웃
              </button>
            </>
          ) : (
            <button className="text-button" onClick={login}>
              로그인
            </button>
          )}
        </nav>
      </header>
      <main className="page-shell">
        <section className="intro">
          <p className="intro-note">함께 읽고, 더 깊이 생각하는 시간</p>
          <h1>
            다음 이야기를
            <br />
            함께 시작해요.
          </h1>
          <p className="intro-description">
            서로 다른 경험을 나누는 작은 스터디.
            <br />
            마음이 가는 주제와 다음 만남을 골라 보세요.
          </p>
        </section>
        {loadError ? (
          <section className="load-error" role="alert">
            <h2>모임을 불러오지 못했어요</h2>
            <p>잠시 후 다시 불러와 주세요. 신청 내역은 로그인 후 확인할 수 있어요.</p>
            <button className="button secondary" onClick={refresh} disabled={refreshing}>
              다시 불러오기
            </button>
          </section>
        ) : !session ? (
          <section className="load-error">
            <h2>새 모임을 준비하고 있어요</h2>
            <p>다음 만남이 열리면 여기에서 확인할 수 있어요.</p>
          </section>
        ) : (
          <>
            <section className="featured" aria-label="선택한 모임">
              <div className="session-story">
                <div className="date-stamp">
                  <span className="date-day">
                    {date(session.startsAt, { day: "2-digit" }).replace(/[^0-9]/g, "")}
                  </span>
                  <div>
                    <strong>{date(session.startsAt, { month: "long" })}</strong>
                    <span>
                      {date(session.startsAt, {
                        weekday: "long",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </span>
                  </div>
                </div>
                <h2>{session.title}</h2>
                <p className="session-description">{session.description}</p>
                <dl className="session-facts">
                  <div>
                    <dt>만나는 곳</dt>
                    <dd>온라인 모임</dd>
                  </div>
                  <div>
                    <dt>신청 마감</dt>
                    <dd>
                      {date(session.closesAt, {
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    </dd>
                  </div>
                </dl>
                <p className="small-note">모임이 시작되기 전에 안내를 확인해 주세요.</p>
              </div>
              <aside className="booking-panel" aria-label="참가 신청">
                <div className="availability">
                  <span>
                    {mine
                      ? "내 자리가 준비됐어요"
                      : isFull
                        ? "모집이 끝났어요"
                        : isClosed
                          ? "신청 마감"
                          : remaining === 1
                            ? "마지막 한 자리"
                            : "함께할 자리가 있어요"}
                  </span>
                  <strong>
                    {session.registeredCount}
                    <small> / {session.capacity}명</small>
                  </strong>
                </div>
                <div className="seat-map" aria-hidden="true">
                  {Array.from({ length: Math.min(session.capacity, 20) }, (_, i) => (
                    <span
                      key={i}
                      className={`seat ${i < session.registeredCount ? "occupied" : "available"}`}
                    />
                  ))}
                </div>
                <p className="seat-explanation">
                  {mine
                    ? "이 모임의 참가 신청이 확정됐어요."
                    : isFull
                      ? "현재 모든 자리가 확정됐어요."
                      : isClosed
                        ? "다음 모임도 확인해 보세요."
                        : `최대 ${session.capacity}명이 함께 이야기해요.`}
                </p>
                {mine && (
                  <div className="confirmation">
                    <span aria-hidden="true">✓</span>
                    <div>
                      <strong>참가 확정</strong>
                      <p>신청 번호 {mine}</p>
                    </div>
                  </div>
                )}
                <button
                  className={`button ${mine ? "secondary" : "primary"}`}
                  onClick={register}
                  disabled={state.kind === "pending" || (!mine && (isFull || isClosed))}
                >
                  {state.kind === "pending"
                    ? "신청 확인 중…"
                    : state.kind === "auth"
                      ? "다시 로그인"
                      : mine
                        ? "내 신청 확인"
                        : isFull
                          ? "정원이 찼어요"
                          : isClosed
                            ? "신청이 마감됐어요"
                            : !viewerName
                              ? "로그인하고 신청"
                              : "참가 신청"}
                </button>
                <div
                  className={`result-message ${["unknown", "full", "auth"].includes(state.kind) ? "is-error" : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  {state.message}
                </div>
                <p className="booking-note">
                  신청 결과가 보이지 않으면 다시 확인해 주세요.
                  <br />
                  이미 확정된 신청은 중복으로 추가되지 않아요.
                </p>
              </aside>
            </section>
            <section className="other-sessions" aria-labelledby="other-title">
              <div className="section-heading">
                <h2 id="other-title">함께할 다른 모임</h2>
                <span>{sessions.length}개의 만남</span>
              </div>
              <ul>
                {sessions.map((s) => (
                  <li key={s.id}>
                    <button
                      className={`session-row ${session.id === s.id ? "selected" : ""}`}
                      onClick={() => {
                        setSelected(s.id);
                        setState(initial);
                      }}
                      aria-pressed={session.id === s.id}
                    >
                      <span className="row-date">
                        {date(s.startsAt, { month: "2-digit", day: "2-digit" })}
                      </span>
                      <span className="row-title">{s.title}</span>
                      <span className={`row-state ${s.myRegistrationId ? "confirmed" : ""}`}>
                        {s.myRegistrationId
                          ? "참가 확정"
                          : s.registeredCount >= s.capacity
                            ? "모집 완료"
                            : s.registrationOpen
                              ? `${s.capacity - s.registeredCount}자리 남음`
                              : "신청 마감"}
                      </span>
                      <span className="row-mark" aria-hidden="true">
                        +
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
      <footer className="site-footer page-shell">
        <span>다음 모임</span>
        <p>작은 모임에서 더 넓은 생각으로.</p>
      </footer>
    </>
  );
}
