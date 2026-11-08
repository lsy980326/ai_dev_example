"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell error-page">
      <h1>모임을 불러오지 못했어요</h1>
      <p>연결 상태를 확인한 뒤 다시 불러와 주세요.</p>
      <button className="button primary" onClick={reset}>
        다시 불러오기
      </button>
    </main>
  );
}
