"use client";

import React, { createContext, useContext, useState } from "react";

interface CrosshairContextValue {
  /** The date string currently under the crosshair, or null */
  crosshairDate: string | null;
  setCrosshairDate: (date: string | null) => void;
}

const CrosshairContext = createContext<CrosshairContextValue>({
  crosshairDate: null,
  setCrosshairDate: () => {},
});

export function CrosshairProvider({ children }: { children: React.ReactNode }) {
  const [crosshairDate, setCrosshairDate] = useState<string | null>(null);
  return (
    <CrosshairContext.Provider value={{ crosshairDate, setCrosshairDate }}>
      {children}
    </CrosshairContext.Provider>
  );
}

export function useCrosshair() {
  return useContext(CrosshairContext);
}
