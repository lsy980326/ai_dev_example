import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "다음 모임 | 스터디 예약",
  description: "함께 깊게 생각할 스터디를 만나고 다음 모임에 참가하세요.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
