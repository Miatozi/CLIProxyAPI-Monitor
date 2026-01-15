import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import ClientLayout from "./components/ClientLayout";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "CLIProxyAPI Usage Dashboard",
  description: "Usage analytics and cost tracking for CLIProxy API"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem("theme");var prefers=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches;var isDark=saved?saved==="dark":prefers;document.documentElement.classList.toggle("dark",!!isDark);}catch(e){}})();`
          }}
        />
      </head>
      <body className="bg-gradient-mesh text-slate-100 font-sans">
        <ClientLayout>{children}</ClientLayout>
        <Analytics />
      </body>
    </html>
  );
}
