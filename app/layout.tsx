import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ChatLauncher from "./components/chat-launcher";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Kidohomes Demo";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: appName,
  title: {
    default: "Kidohomes — Thiết bị vệ sinh cho phòng tắm hiện đại",
    template: `%s · ${appName}`,
  },
  description:
    "Tìm thiết bị vệ sinh theo ngân sách, diện tích và phong cách, hoặc trò chuyện với trợ lý AI Kidohomes để chọn phương án phù hợp. Catalog và chính sách trong bản này là dữ liệu demo.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: appName,
    title: "Kidohomes — Thiết bị vệ sinh cho phòng tắm hiện đại",
    description:
      "Tìm thiết bị vệ sinh theo ngân sách, diện tích và phong cách cùng trợ lý AI Kidohomes.",
    images: [{ url: "/product-images/bathroom-spa.jpg", width: 1200, height: 630, alt: "Không gian phòng tắm hiện đại" }],
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans text-slate-900">
        {children}
        <ChatLauncher />
      </body>
    </html>
  );
}
