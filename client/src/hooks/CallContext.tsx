import { createContext, useContext, type ReactNode } from "react";
import { useWebRTC } from "./useWebRTC";

export type CallContextValue = ReturnType<typeof useWebRTC>;

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const call = useWebRTC();
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>;
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within CallProvider");
  return ctx;
}
