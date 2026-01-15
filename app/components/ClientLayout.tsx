"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const applyInitialTheme = () => {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem("theme") : null;
      const prefersDark = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true;
      const isDark = saved ? saved === "dark" : prefersDark;
      document.documentElement.classList.toggle("dark", isDark);
    };

    applyInitialTheme();
  }, []);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="fixed left-4 top-4 z-50 md:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="rounded-lg bg-slate-900 p-2 text-slate-300 shadow-lg ring-1 ring-slate-700 hover:bg-slate-800 hover:text-white"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Navigation Drawer */}
      <MobileNav isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      {/* Main Content */}
      <div className="ml-0 md:ml-56 min-h-screen transition-[margin] duration-200">
        {children}
      </div>
    </>
  );
}
