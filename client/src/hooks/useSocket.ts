import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { api } from "../api/client";
import { addMessage, setTyping, setPresence, setChats, markRead } from "../store/slices/chatSlice";

// One shared socket for the whole app, established after login.
export function useSocket() {
  const token = useAppSelector((s) => s.auth.accessToken);
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL ?? "/", { auth: { token } });
    socketRef.current = socket;

    socket.on("message:new", (msg) => {
      dispatch(addMessage(msg));
      // Refresh the chat list so a brand-new conversation shows up and
      // last-message previews stay current.
      api
        .get("/chats")
        .then((r) => dispatch(setChats(r.data)))
        .catch(() => {});
    });
    socket.on("typing:start", ({ chatId, userId }) =>
      dispatch(setTyping({ chatId, userId, typing: true })),
    );
    socket.on("typing:stop", ({ chatId, userId }) =>
      dispatch(setTyping({ chatId, userId, typing: false })),
    );
    socket.on("presence:update", ({ userId, isOnline }) =>
      dispatch(setPresence({ userId, isOnline })),
    );
    socket.on("message:read", ({ chatId, messageId, userId }) =>
      dispatch(markRead({ chatId, messageId, userId }))
    );

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, dispatch]);

  return socketRef;
}
