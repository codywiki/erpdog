import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "erpdog",
  description: "Internal ERP for long-running service operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
