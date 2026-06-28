import { useEffect, useState } from "react";
import { api } from "./api/client";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { setAccessToken, setUser, logout } from "./store/slices/authSlice";
import { setActiveChat } from "./store/slices/chatSlice";
import { SocketProvider } from "./hooks/SocketContext";
import { CallProvider } from "./hooks/CallContext";
import { AuthPage } from "./pages/AuthPage";
import { ChatPage } from "./pages/ChatPage";
import { CallOverlay } from "./components/CallOverlay";

export default function App() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.accessToken);
  const [booting, setBooting] = useState(true);

  // On first load, try to silently restore a session via the refresh cookie.
  useEffect(() => {
    (async () => {
      try {
        const r = await api.post("/auth/refresh");
        dispatch(setAccessToken(r.data.accessToken));
        const me = await api.get("/users/me");
        dispatch(setUser(me.data));
      } catch {
        // No valid session — that's fine, show the login screen.
        dispatch(logout());
      } finally {
        setBooting(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Opened from a push notification click (sw.js navigates to /?chat=<id>).
  useEffect(() => {
    if (!token) return;
    const params = new URLSearchParams(window.location.search);
    const chatId = params.get("chat");
    if (!chatId) return;
    dispatch(setActiveChat(chatId));
    params.delete("chat");
    const newSearch = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (newSearch ? `?${newSearch}` : ""));
  }, [token, dispatch]);

  if (booting) {
    return (
      <div className="h-full flex items-center justify-center text-muted">Loading…</div>
    );
  }

  if (!token) return <AuthPage />;

  return (
    <SocketProvider>
      <CallProvider>
        <ChatPage />
        <CallOverlay />
      </CallProvider>
    </SocketProvider>
  );
}
