import type { Metadata } from "next";
import localFont from "next/font/local";

import "@/app/globals.css";

const aeonikMono = localFont({
  src: "../fonts/AeonikMono-Regular.woff2",
  display: "swap",
  style: "normal",
  variable: "--font-aeonik-mono",
  weight: "400",
});

export const metadata: Metadata = {
  title: "AI 求职助手｜简历对岗优化平台",
  description: "用于简历诊断、岗位对齐和可执行改写建议生成的一站式工作台。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${aeonikMono.variable} bg-background font-sans text-foreground antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
