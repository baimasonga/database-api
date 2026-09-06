import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AVDP Integrated Data & Analytics Platform",
  description:
    "Agricultural Value Chain Development Project — analytics dashboard and data governance platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
