import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setChats, setActiveChat, upsertChat } from "../store/slices/chatSlice";
import { logout } from "../store/slices/authSlice";
import { Avatar } from "./Avatar";
import type { Chat, User } from "../types";

export function Sidebar() {
  const dispatch = useAppDispatch();
  const { chats, activeChatId, onlineUsers } = useAppSelector((s) => s.chat);
  const me = useAppSelector((s) => s.auth.user);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);

  useEffect(() => {
    api.get<Chat[]>("/chats").then((r) => dispatch(setChats(r.data)));
  }, [dispatch]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      api
        .get<User[]>(`/chats/search/users?q=${encodeURIComponent(query)}`)
        .then((r) => setResults(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  async function openDirect(userId: string) {
    const { data } = await api.post<Chat>(`/chats/direct/${userId}`);
    dispatch(upsertChat(data));
    dispatch(setActiveChat(data.id));
    setSearching(false);
    setQuery("");
  }

  function chatTitle(chat: Chat): { name: string; userId?: string } {
    if (chat.isGroup) return { name: chat.name ?? "Group" };
    const other = chat.members.find((m) => m.userId !== me?.id);
    return {
      name: other?.user?.displayName ?? "Unknown",
      userId: other?.userId,
    };
  }

  return (
    <aside className="w-full sm:w-80 border-r border-surface bg-panel flex flex-col h-full">
      <header className="flex items-center justify-between px-4 py-3 border-b border-surface">
        <div className="flex items-center gap-2">
          <Avatar name={me?.displayName ?? "?"} src={me?.avatarUrl} size={36} />
          <span className="font-semibold text-sm">{me?.displayName}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSearching((s) => !s)}
            className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-lg"
            title="New chat"
          >
            ＋
          </button>
          <button
            onClick={async () => {
              await api.post("/auth/logout");
              dispatch(logout());
            }}
            className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-sm text-muted"
            title="Log out"
          >
            ⏻
          </button>
        </div>
      </header>

      {searching && (
        <div className="p-3 border-b border-surface">
          <input
            autoFocus
            placeholder="Search people by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-ink border border-surface rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
          <div className="mt-2 space-y-1">
            {results.map((u) => (
              <button
                key={u.id}
                onClick={() => openDirect(u.id)}
                className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface text-left"
              >
                <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
                <div>
                  <div className="text-sm font-medium">{u.displayName}</div>
                  <div className="text-xs text-muted">@{u.username}</div>
                </div>
              </button>
            ))}
            {query && results.length === 0 && (
              <p className="text-xs text-muted px-2 py-3">No people found.</p>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 && !searching && (
          <p className="text-sm text-muted text-center mt-10 px-6">
            No conversations yet. Tap ＋ to start one.
          </p>
        )}
        {chats.map((chat) => {
          const { name, userId } = chatTitle(chat);
          const last = chat.messages?.[0];
          const online = userId ? onlineUsers[userId] : undefined;
          return (
            <button
              key={chat.id}
              onClick={() => dispatch(setActiveChat(chat.id))}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition ${
                activeChatId === chat.id ? "bg-surface" : ""
              }`}
            >
              <Avatar
                name={name}
                src={chat.iconUrl}
                size={44}
                online={online}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-sm truncate">{name}</div>
                <div className="text-xs text-muted truncate">
                  {last?.content ??
                    (last ? "📎 Attachment" : "No messages yet")}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
