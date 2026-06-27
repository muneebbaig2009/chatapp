import { createContext, useContext, type ReactNode } from "react";
import type { Socket } from "socket.io-client";
import { useSocket } from "./useSocket";

const SocketContext = createContext<React.MutableRefObject<Socket | null> | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useSocket();
  return <SocketContext.Provider value={socketRef}>{children}</SocketContext.Provider>;
}

export function useSocketRef() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSocketRef must be used within SocketProvider");
  return ctx;
}
