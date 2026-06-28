import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { store } from "../store";
import { api } from "../api/client";
import {
  addMessage, setTyping, setPresence, setChats, markRead, upsertChat, removeChat, updateMessage,
} from "../store/slices/chatSlice";
import { upsertCallLogEntry } from "../store/slices/callSlice";
import { setStatusFeed } from "../store/slices/statusSlice";
import type { Chat, CallLogEntry, Message } from "../types";

// One shared socket for the whole app, established after login.
export function useSocket() {
  const token = useAppSelector((s) => s.auth.accessToken);
  const dispatch = useAppDispatch();
  const socketRef = useRef<Socket | null>(null);
  // Bumped whenever the socket instance is replaced (e.g. after a token
  // refresh), so consumers that bind .on() listeners outside this hook know
  // to rebind to the fresh instance instead of a stale, disconnected one.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL ?? "/", { auth: { token } });
    socketRef.current = socket;
    setVersion((v) => v + 1);

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
    // Membership changed (added/removed/promoted/left/renamed). If we're
    // still a member, refresh the chat; otherwise drop it from our list.
    socket.on("group:updated", (chat: Chat) => {
      const meId = store.getState().auth.user?.id;
      const stillMember = chat.members.some((m) => m.userId === meId);
      if (stillMember) dispatch(upsertChat(chat));
      else dispatch(removeChat(chat.id));
    });
    // A call reached a terminal state (missed/answered-and-ended/rejected/
    // cancelled) — refresh the Calls tab without a manual refetch.
    socket.on("call:logged", (entry: CallLogEntry) => dispatch(upsertCallLogEntry(entry)));
    // Edited or deleted-for-everyone — both just replace the message in place.
    socket.on("message:edited", (msg: Message) => dispatch(updateMessage(msg)));
    socket.on("message:deleted", (msg: Message) => dispatch(updateMessage(msg)));
    // A contact posted/removed a status. Grouping + unseen-ordering logic
    // lives server-side, so just refetch rather than patching it locally.
    const refetchStatuses = () =>
      api.get("/statuses").then((r) => dispatch(setStatusFeed(r.data))).catch(() => {});
    socket.on("status:new", refetchStatuses);
    socket.on("status:deleted", refetchStatuses);

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, dispatch]);

  return { socketRef, version };
}
