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
  title: "AI 求职助手",
  description: "用于简历分析、JD 对齐与面试包生成的工作台。",
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
