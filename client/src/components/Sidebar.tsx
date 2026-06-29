import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setChats, setActiveChat, upsertChat } from "../store/slices/chatSlice";
import { setCallLog } from "../store/slices/callSlice";
import { setStatusFeed } from "../store/slices/statusSlice";
import { logout } from "../store/slices/authSlice";
import { Avatar } from "./Avatar";
import { CreateGroupModal } from "./CreateGroupModal";
import { CallHistoryList } from "./CallHistoryList";
import { StatusList } from "./StatusList";
import { SettingsModal } from "./SettingsModal";
import { getPushSubscriptionStatus, enablePushNotifications, disablePushNotifications } from "../utils/push";
import { useTheme } from "../utils/theme";
import type { Chat, CallLogEntry, StatusFeed, User } from "../types";

export function Sidebar() {
  const dispatch = useAppDispatch();
  const { chats, activeChatId, onlineUsers } = useAppSelector((s) => s.chat);
  const callLog = useAppSelector((s) => s.calls.log);
  const statusOthers = useAppSelector((s) => s.status.others);
  const me = useAppSelector((s) => s.auth.user);
  const [activeTab, setActiveTab] = useState<"chats" | "calls" | "status">("chats");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  const missedCount = callLog.filter((c) => c.direction === "incoming" && c.status === "MISSED").length;
  const hasUnseenStatus = statusOthers.some((g) => g.hasUnseen);

  useEffect(() => {
    getPushSubscriptionStatus().then(setPushEnabled);
  }, []);

  async function togglePush() {
    setPushBusy(true);
    try {
      if (pushEnabled) {
        await disablePushNotifications();
        setPushEnabled(false);
      } else {
        const granted = await enablePushNotifications();
        setPushEnabled(granted);
        if (!granted) alert("Notification permission was denied.");
      }
    } catch (e: any) {
      alert(e.message ?? "Failed to update push notification settings");
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    api.get<Chat[]>("/chats").then((r) => dispatch(setChats(r.data)));
  }, [dispatch]);

  // Fetched eagerly (not lazily on tab switch) so the missed-call badge is
  // visible even while the Chats tab is active.
  useEffect(() => {
    api.get<CallLogEntry[]>("/calls").then((r) => dispatch(setCallLog(r.data)));
  }, [dispatch]);

  useEffect(() => {
    api.get<StatusFeed>("/statuses").then((r) => dispatch(setStatusFeed(r.data)));
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
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 hover:bg-surface rounded-lg -ml-1 pl-1 pr-2 py-1 transition"
          title="Settings"
        >
          <Avatar name={me?.displayName ?? "?"} src={me?.avatarUrl} size={36} />
          <span className="font-semibold text-sm">{me?.displayName}</span>
        </button>
        <div className="flex items-center gap-1">
          {activeTab === "chats" && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-lg"
                title="New chat or group"
              >
                ＋
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-0" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 bg-panel border border-surface rounded-lg shadow-lg z-10 overflow-hidden">
                    <button
                      onClick={() => { setSearching(true); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface"
                    >
                      💬 New chat
                    </button>
                    <button
                      onClick={() => { setGroupModalOpen(true); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-surface"
                    >
                      👥 New group
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-sm"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <button
            onClick={togglePush}
            disabled={pushBusy}
            className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title={pushEnabled ? "Disable push notifications" : "Enable push notifications"}
          >
            {pushEnabled ? "🔔" : "🔕"}
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

      <div className="flex border-b border-surface">
        <button
          onClick={() => setActiveTab("chats")}
          className={`flex-1 py-2.5 text-sm font-medium transition ${
            activeTab === "chats" ? "text-accent border-b-2 border-accent" : "text-muted hover:text-fg"
          }`}
        >
          Chats
        </button>
        <button
          onClick={() => setActiveTab("calls")}
          className={`flex-1 py-2.5 text-sm font-medium transition relative ${
            activeTab === "calls" ? "text-accent border-b-2 border-accent" : "text-muted hover:text-fg"
          }`}
        >
          Calls
          {missedCount > 0 && (
            <span className="absolute top-1.5 right-1/4 translate-x-1/2 bg-danger text-white text-[10px] leading-none rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
              {missedCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("status")}
          className={`flex-1 py-2.5 text-sm font-medium transition relative ${
            activeTab === "status" ? "text-accent border-b-2 border-accent" : "text-muted hover:text-fg"
          }`}
        >
          Status
          {hasUnseenStatus && (
            <span className="absolute top-2 right-1/4 translate-x-1/2 w-2 h-2 rounded-full bg-accent" />
          )}
        </button>
      </div>

      {activeTab === "chats" && searching && (
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
        {activeTab === "calls" ? (
          <CallHistoryList />
        ) : activeTab === "status" ? (
          <StatusList />
        ) : (
          <>
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
                    isGroup={chat.isGroup}
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
          </>
        )}
      </div>

      {groupModalOpen && <CreateGroupModal onClose={() => setGroupModalOpen(false)} />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </aside>
  );
}
