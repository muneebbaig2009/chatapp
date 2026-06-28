import { useState } from "react";
import { api } from "../api/client";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { addMessage } from "../store/slices/chatSlice";
import { Avatar } from "./Avatar";
import type { Chat, Message } from "../types";

function chatTitle(chat: Chat, meId?: string): string {
  if (chat.isGroup) return chat.name ?? "Group";
  const other = chat.members.find((m) => m.userId !== meId);
  return other?.user?.displayName ?? "Unknown";
}

export function ForwardMessageModal({ message, onClose }: { message: Message; onClose: () => void }) {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  const chats = useAppSelector((s) => s.chat.chats);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(chatId: string) {
    setSelected((s) => (s.includes(chatId) ? s.filter((id) => id !== chatId) : [...s, chatId]));
  }

  async function forward() {
    if (selected.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<Message[]>(`/messages/${message.id}/forward`, { chatIds: selected });
      for (const m of data) dispatch(addMessage(m));
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to forward message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-panel border border-surface rounded-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-surface flex items-center justify-between">
          <h2 className="font-semibold text-sm">Forward message</h2>
          <button onClick={onClose} className="text-muted hover:text-gray-200">✕</button>
        </header>

        <div className="p-2 overflow-y-auto flex-1">
          {chats.length === 0 && (
            <p className="text-sm text-muted text-center mt-10 px-6">No chats to forward to.</p>
          )}
          {chats.map((chat) => {
            const isSelected = selected.includes(chat.id);
            const name = chatTitle(chat, me?.id);
            return (
              <button
                key={chat.id}
                onClick={() => toggle(chat.id)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-surface text-left ${
                  isSelected ? "bg-surface" : ""
                }`}
              >
                <Avatar name={name} src={chat.iconUrl} size={36} isGroup={chat.isGroup} />
                <div className="min-w-0 flex-1 text-sm font-medium truncate">{name}</div>
                {isSelected && <span className="text-accent">✓</span>}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-red-400 px-4 pb-2">{error}</p>}

        <footer className="p-3 border-t border-surface">
          <button
            disabled={busy || selected.length === 0}
            onClick={forward}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-ink font-medium rounded-lg py-2 text-sm transition"
          >
            {busy ? "Forwarding…" : `Forward${selected.length > 0 ? ` (${selected.length})` : ""}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
