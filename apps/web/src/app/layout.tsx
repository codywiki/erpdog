import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "erpdog",
  description:
    "面向长期服务型业务的客户、合同、账单、结算、成本付款和月结利润 ERP 系统",
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
