import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { upsertChat, removeChat, setActiveChat } from "../store/slices/chatSlice";
import { Avatar } from "./Avatar";
import type { Chat, User } from "../types";

export function GroupInfoModal({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  const isAdmin = !!chat.members.find((m) => m.userId === me?.id)?.isAdmin;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(chat.name ?? "");
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const memberIds = new Set(chat.members.map((m) => m.userId));
    const t = setTimeout(() => {
      api
        .get<User[]>(`/chats/search/users?q=${encodeURIComponent(query)}`)
        .then((r) => setResults(r.data.filter((u) => !memberIds.has(u.id))));
    }, 250);
    return () => clearTimeout(t);
  }, [query, chat.members]);

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch<Chat>(`/chats/${chat.id}`, { name: trimmed });
      dispatch(upsertChat(data));
      setEditingName(false);
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to update group");
    } finally {
      setBusy(false);
    }
  }

  async function addMember(userId: string) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<Chat>(`/chats/${chat.id}/members`, { memberIds: [userId] });
      dispatch(upsertChat(data));
      setQuery("");
      setResults([]);
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to add member");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.delete<Chat>(`/chats/${chat.id}/members/${userId}`);
      dispatch(upsertChat(data));
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to remove member");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAdmin(userId: string, value: boolean) {
    setBusy(true);
    setError("");
    try {
      const { data } = await api.patch<Chat>(`/chats/${chat.id}/members/${userId}/admin`, {
        isAdmin: value,
      });
      dispatch(upsertChat(data));
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to update admin status");
    } finally {
      setBusy(false);
    }
  }

  async function leaveGroup() {
    if (!me) return;
    setBusy(true);
    setError("");
    try {
      await api.delete(`/chats/${chat.id}/members/${me.id}`);
      dispatch(removeChat(chat.id));
      dispatch(setActiveChat(null));
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to leave group");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-panel border border-surface rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-surface flex items-center justify-between">
          <h2 className="font-semibold text-sm">Group info</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">✕</button>
        </header>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center gap-3">
            <Avatar name={chat.name ?? "Group"} src={chat.iconUrl} size={56} isGroup />
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveName()}
                    className="flex-1 bg-ink border border-surface rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
                  />
                  <button
                    disabled={busy}
                    onClick={saveName}
                    className="text-accent text-sm font-medium hover:text-accent-dim"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="font-medium text-sm truncate">{chat.name ?? "Group"}</div>
                  {isAdmin && (
                    <button
                      onClick={() => { setNameDraft(chat.name ?? ""); setEditingName(true); }}
                      className="text-muted hover:text-fg text-xs"
                      title="Edit name"
                    >
                      ✎
                    </button>
                  )}
                </div>
              )}
              <div className="text-xs text-muted">
                {chat.members.length} member{chat.members.length === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          {isAdmin && (
            <div className="space-y-2">
              {adding ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    placeholder="Search people to add…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-ink border border-surface rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
                  />
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {results.map((u) => (
                      <button
                        key={u.id}
                        disabled={busy}
                        onClick={() => addMember(u.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface text-left"
                      >
                        <Avatar name={u.displayName} src={u.avatarUrl} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{u.displayName}</div>
                          <div className="text-xs text-muted">@{u.username}</div>
                        </div>
                      </button>
                    ))}
                    {query && results.length === 0 && (
                      <p className="text-xs text-muted px-2 py-3">No people found.</p>
                    )}
                  </div>
                  <button
                    onClick={() => { setAdding(false); setQuery(""); setResults([]); }}
                    className="text-xs text-muted hover:text-fg"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="text-sm text-accent hover:text-accent-dim font-medium"
                >
                  + Add member
                </button>
              )}
            </div>
          )}

          <ul className="space-y-1">
            {chat.members.map((m) => {
              const isSelf = m.userId === me?.id;
              return (
                <li key={m.userId} className="flex items-center gap-3 p-2 rounded-lg">
                  <Avatar name={m.user.displayName} src={m.user.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {m.user.displayName} {isSelf && <span className="text-muted">(you)</span>}
                    </div>
                    {m.isAdmin && <div className="text-xs text-accent">Admin</div>}
                  </div>
                  {isAdmin && !isSelf && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        disabled={busy}
                        onClick={() => toggleAdmin(m.userId, !m.isAdmin)}
                        className="text-xs text-muted hover:text-fg"
                      >
                        {m.isAdmin ? "Demote" : "Promote"}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => removeMember(m.userId)}
                        className="text-xs text-danger hover:text-danger-dim"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <footer className="p-3 border-t border-surface">
          <button
            disabled={busy}
            onClick={leaveGroup}
            className="w-full text-danger hover:text-danger-dim font-medium rounded-lg py-2 text-sm transition"
          >
            Leave group
          </button>
        </footer>
      </div>
    </div>
  );
}
