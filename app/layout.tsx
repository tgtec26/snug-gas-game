import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "공기 진료소 (가제)",
  description: "중1 과학 Ⅵ. 기체의 성질 학습 게임 — 환자의 사연을 보고 같은 계기를 돌려 압력과 온도에 따른 부피 변화를 확인한다",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
