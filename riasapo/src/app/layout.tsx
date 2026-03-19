import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "リアサポ",
  description: "プログラミング学習をサポートするアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased bg-[#0A0A0B] text-slate-200 h-screen flex flex-col overflow-hidden">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
