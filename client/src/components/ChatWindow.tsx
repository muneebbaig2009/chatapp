import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setMessages } from "../store/slices/chatSlice";
import { useSocketRef } from "../hooks/SocketContext";
import { MessageBubble } from "./MessageBubble";
import { Avatar } from "./Avatar";
import type { Message } from "../types";

export function ChatWindow() {
  const dispatch = useAppDispatch();
  const socketRef = useSocketRef();
  const me = useAppSelector((s) => s.auth.user);
  const { activeChatId, chats, messages, typing, onlineUsers } = useAppSelector(
    (s) => s.chat,
  );
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = chats.find((c) => c.id === activeChatId);
  const chatMessages = activeChatId ? (messages[activeChatId] ?? []) : [];

  const other =
    chat && !chat.isGroup
      ? chat.members.find((m) => m.userId !== me?.id)
      : undefined;
  const title = chat?.isGroup
    ? (chat.name ?? "Group")
    : (other?.user?.displayName ?? "");
  const online = other ? onlineUsers[other.userId] : undefined;
  const someoneTyping = activeChatId
    ? (typing[activeChatId]?.length ?? 0) > 0
    : false;

  // Load history + join the chat room when switching chats.
  // Load history + join the chat room when switching chats.
  useEffect(() => {
    if (!activeChatId) return;
    socketRef.current?.emit("chat:join", activeChatId);
    api
      .get<Message[]>(`/chats/${activeChatId}/messages`)
      .then((r) =>
        dispatch(setMessages({ chatId: activeChatId, messages: r.data })),
      );
    return () => {
      socketRef.current?.emit("chat:leave", activeChatId);
    };
  }, [activeChatId, dispatch, socketRef]);

  // Mark the other person's messages as read whenever they're visible.
  useEffect(() => {
    if (!activeChatId) return;
    for (const m of chatMessages) {
      if (m.senderId !== me?.id) {
        socketRef.current?.emit("message:read", {
          chatId: activeChatId,
          messageId: m.id,
        });
      }
    }
  }, [activeChatId, chatMessages, me?.id, socketRef]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, someoneTyping]);

  function send() {
    const text = draft.trim();
    if (!text || !activeChatId) return;
    socketRef.current?.emit("message:send", {
      chatId: activeChatId,
      content: text,
      type: "TEXT",
    });
    socketRef.current?.emit("typing:stop", activeChatId);
    setDraft("");
  }

  function onType(v: string) {
    setDraft(v);
    if (!activeChatId) return;
    socketRef.current?.emit("typing:start", activeChatId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socketRef.current?.emit("typing:stop", activeChatId),
      1500,
    );
  }

  if (!chat) {
    return (
      <section className="flex-1 hidden sm:flex items-center justify-center text-center px-6">
        <div>
          <div className="text-5xl mb-3">◗</div>
          <p className="text-muted">Pick a conversation to start messaging.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 flex flex-col h-full bg-ink">
      <header className="flex items-center gap-3 px-4 py-3 border-b border-surface bg-panel">
        <Avatar name={title} src={chat.iconUrl} size={40} online={online} />
        <div>
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted">
            {someoneTyping
              ? "typing…"
              : online
                ? "online"
                : other
                  ? "offline"
                  : ""}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto py-4 space-y-1.5">
        {chatMessages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={m.senderId === me?.id}
            readByOther={!!m.receipts?.some((r) => r.userId !== me?.id)}
          />
        ))}
        {someoneTyping && (
          <div className="px-4">
            <div className="inline-flex gap-1 bg-bubble rounded-2xl px-3 py-2">
              <Dot /> <Dot delay="150ms" /> <Dot delay="300ms" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <footer className="p-3 border-t border-surface bg-panel">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={draft}
            onChange={(e) => onType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Type a message"
            className="flex-1 resize-none bg-ink border border-surface rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60 max-h-32"
          />
          <button
            onClick={send}
            className="w-11 h-11 shrink-0 rounded-full bg-accent hover:bg-accent-dim text-ink flex items-center justify-center text-lg transition"
          >
            ➤
          </button>
        </div>
      </footer>
    </section>
  );
}

function Dot({ delay = "0ms" }: { delay?: string }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce"
      style={{ animationDelay: delay }}
    />
  );
}
