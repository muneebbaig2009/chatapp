import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAppDispatch } from "../store/hooks";
import { upsertChat, setActiveChat } from "../store/slices/chatSlice";
import { Avatar } from "./Avatar";
import type { Chat, User } from "../types";

export function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  function toggleSelect(user: User) {
    setSelected((s) =>
      s.some((u) => u.id === user.id) ? s.filter((u) => u.id !== user.id) : [...s, user],
    );
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || selected.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<Chat>("/chats/group", {
        name: trimmed,
        memberIds: selected.map((u) => u.id),
      });
      dispatch(upsertChat(data));
      dispatch(setActiveChat(data.id));
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to create group");
    } finally {
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
          <h2 className="font-semibold text-sm">New group</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">✕</button>
        </header>

        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <input
            autoFocus
            placeholder="Group name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-ink border border-surface rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
          />

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="flex items-center gap-1 bg-surface rounded-full pl-1 pr-2 py-1 text-xs"
                >
                  <Avatar name={u.displayName} src={u.avatarUrl} size={20} />
                  {u.displayName}
                  <button onClick={() => toggleSelect(u)} className="text-muted hover:text-fg">✕</button>
                </span>
              ))}
            </div>
          )}

          <input
            placeholder="Search people to add…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-ink border border-surface rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
          />

          <div className="space-y-1">
            {results.map((u) => {
              const isSelected = selected.some((s) => s.id === u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => toggleSelect(u)}
                  className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface text-left ${
                    isSelected ? "bg-surface" : ""
                  }`}
                >
                  <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{u.displayName}</div>
                    <div className="text-xs text-muted">@{u.username}</div>
                  </div>
                  {isSelected && <span className="text-accent">✓</span>}
                </button>
              );
            })}
            {query && results.length === 0 && (
              <p className="text-xs text-muted px-2 py-3">No people found.</p>
            )}
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <footer className="p-3 border-t border-surface">
          <button
            disabled={busy || !name.trim() || selected.length === 0}
            onClick={create}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-accent-fg font-medium rounded-lg py-2 text-sm transition"
          >
            {busy ? "Creating…" : "Create group"}
          </button>
        </footer>
      </div>
    </div>
  );
}
