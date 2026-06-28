import { createContext, useContext, type MutableRefObject, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { useSocket } from "./useSocket";

interface SocketContextValue {
  ref: MutableRefObject<Socket | null>;
  version: number;
}

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { socketRef, version } = useSocket();
  return (
    <SocketContext.Provider value={{ ref: socketRef, version }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocketRef() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocketRef must be used within SocketProvider");
  return ctx.ref;
}

// Bumps whenever the underlying socket instance is replaced (e.g. after a
// token refresh). Effects that bind .on() listeners outside useSocket()
// should depend on this so they rebind instead of staying attached to a
// stale, disconnected socket.
export function useSocketVersion() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocketVersion must be used within SocketProvider");
  return ctx.version;
}
