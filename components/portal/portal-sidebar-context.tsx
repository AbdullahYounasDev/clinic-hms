"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface PortalSidebarContextType {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
}

const PortalSidebarContext = createContext<PortalSidebarContextType | undefined>(undefined);

export function PortalSidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = () => setMobileOpen((prev) => !prev);

  return (
    <PortalSidebarContext.Provider value={{ mobileOpen, setMobileOpen, toggleMobile }}>
      {children}
    </PortalSidebarContext.Provider>
  );
}

export function usePortalSidebar() {
  const context = useContext(PortalSidebarContext);
  if (!context) {
    throw new Error("usePortalSidebar must be used within PortalSidebarProvider");
  }
  return context;
}
