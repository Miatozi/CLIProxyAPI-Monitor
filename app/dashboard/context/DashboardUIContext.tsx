"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface DashboardUIContextValue {
  fullscreenChart: string | null;
  setFullscreenChart: (chart: string | null) => void;
}

const DashboardUIContext = createContext<DashboardUIContextValue | undefined>(undefined);

export function DashboardUIProvider({ children }: { children: ReactNode }) {
  const [fullscreenChart, setFullscreenChart] = useState<string | null>(null);

  return (
    <DashboardUIContext.Provider value={{ fullscreenChart, setFullscreenChart }}>
      {children}
    </DashboardUIContext.Provider>
  );
}

export function useDashboardUI() {
  const context = useContext(DashboardUIContext);
  if (!context) {
    throw new Error("useDashboardUI must be used within DashboardUIProvider");
  }
  return context;
}
