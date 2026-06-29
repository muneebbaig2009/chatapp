import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { uploadToCloudinary } from "../api/cloudinary";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setMessages, setActiveChat, updateMessage, removeMessageLocal, upsertChat } from "../store/slices/chatSlice";
import { useSocketRef } from "../hooks/SocketContext";
import { useCall } from "../hooks/CallContext";
import { MessageBubble } from "./MessageBubble";
import { Avatar } from "./Avatar";
import { GroupInfoModal } from "./GroupInfoModal";
import { ForwardMessageModal } from "./ForwardMessageModal";
import type { Chat, Message } from "../types";

type MediaType = "IMAGE" | "VIDEO" | "AUDIO" | "VOICE" | "FILE";

interface PendingUpload {
  id: string;
  chatId: string;
  type: MediaType;
  fileName: string;
  previewUrl?: string;
  error?: boolean;
}

function detectType(file: File): MediaType {
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  if (file.type.startsWith("audio/")) return "AUDIO";
  return "FILE";
}

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ChatWindow() {
  const dispatch = useAppDispatch();
  const socketRef = useSocketRef();
  const call = useCall();
  const me = useAppSelector((s) => s.auth.user);
  const { activeChatId, chats, messages, typing, onlineUsers } = useAppSelector((s) => s.chat);
  const [draft, setDraft] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chat = chats.find((c) => c.id === activeChatId);
  const chatMessages = activeChatId ? messages[activeChatId] ?? [] : [];
  const chatPendingUploads = pendingUploads.filter((u) => u.chatId === activeChatId);

  const other = chat && !chat.isGroup
    ? chat.members.find((m) => m.userId !== me?.id)
    : undefined;
  const title = chat?.isGroup ? chat.name ?? "Group" : other?.user?.displayName ?? "";
  const online = other ? onlineUsers[other.userId] : undefined;
  const someoneTyping = activeChatId ? (typing[activeChatId]?.length ?? 0) > 0 : false;
  const isAdmin = !!chat?.members.find((m) => m.userId === me?.id)?.isAdmin;

  // Reset per-chat composer state (edit/forward) whenever the active chat changes.
  useEffect(() => {
    setEditingMessage(null);
    setForwardingMessage(null);
    setDraft("");
  }, [activeChatId]);

  // Load history + join the chat room when switching chats.
  useEffect(() => {
    if (!activeChatId) return;
    socketRef.current?.emit("chat:join", activeChatId);
    api.get<Message[]>(`/chats/${activeChatId}/messages`).then((r) =>
      dispatch(setMessages({ chatId: activeChatId, messages: r.data }))
    );
    return () => { socketRef.current?.emit("chat:leave", activeChatId); };
  }, [activeChatId, dispatch, socketRef]);

  // Mark the other person's messages as read whenever they're on screen.
  useEffect(() => {
    if (!activeChatId) return;
    for (const m of chatMessages) {
      if (m.senderId !== me?.id) {
        socketRef.current?.emit("message:read", { chatId: activeChatId, messageId: m.id });
      }
    }
  }, [activeChatId, chatMessages, me?.id, socketRef]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages.length, someoneTyping, chatPendingUploads.length]);

  // Stop any in-progress recording if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function removePending(id: string) {
    setPendingUploads((p) => {
      const item = p.find((u) => u.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return p.filter((u) => u.id !== id);
    });
  }

  function markFailed(id: string) {
    setPendingUploads((p) => p.map((u) => (u.id === id ? { ...u, error: true } : u)));
    setTimeout(() => removePending(id), 4000);
  }

  async function uploadAndSend(file: File, chatId: string, forcedType?: MediaType) {
    const type = forcedType ?? detectType(file);
    const id = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const previewUrl = type === "IMAGE" || type === "VIDEO" ? URL.createObjectURL(file) : undefined;
    setPendingUploads((p) => [...p, { id, chatId, type, fileName: file.name, previewUrl }]);

    try {
      const { url, fileName, fileSize } = await uploadToCloudinary(file);
      socketRef.current?.emit(
        "message:send",
        { chatId, type, fileUrl: url, fileName, fileSize },
        (res: { ok: boolean }) => {
          if (!res?.ok) markFailed(id);
          else removePending(id);
        },
      );
    } catch {
      markFailed(id);
    }
  }

  function handleFiles(files: FileList | File[]) {
    if (!activeChatId) return;
    for (const file of Array.from(files)) uploadAndSend(file, activeChatId);
  }

  async function startRecording() {
    if (!activeChatId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;
      const recorder = new MediaRecorder(stream);
      const chatId = activeChatId;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelledRef.current && chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: blob.type });
          uploadAndSend(file, chatId, "VOICE");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  }

  function stopRecordingInternal() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
  }

  function stopRecording() {
    cancelledRef.current = false;
    stopRecordingInternal();
  }

  function cancelRecording() {
    cancelledRef.current = true;
    stopRecordingInternal();
  }

  function send() {
    const text = draft.trim();
    if (!text || !activeChatId) return;
    socketRef.current?.emit("message:send", { chatId: activeChatId, content: text, type: "TEXT" });
    socketRef.current?.emit("typing:stop", activeChatId);
    setDraft("");
  }

  function handleSubmit() {
    if (editingMessage) saveEdit();
    else send();
  }

  function onType(v: string) {
    setDraft(v);
    if (!activeChatId) return;
    socketRef.current?.emit("typing:start", activeChatId);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(
      () => socketRef.current?.emit("typing:stop", activeChatId),
      1500
    );
  }

  function placeCall(callType: "voice" | "video") {
    if (!chat || chat.isGroup || !other) return;
    call.startCall(
      chat.id,
      { id: other.userId, displayName: other.user.displayName, avatarUrl: other.user.avatarUrl },
      callType,
    );
  }

  function startEdit(message: Message) {
    setEditingMessage(message);
    setDraft(message.content ?? "");
  }

  function cancelEdit() {
    setEditingMessage(null);
    setDraft("");
  }

  async function saveEdit() {
    if (!editingMessage) return;
    const content = draft.trim();
    if (!content) return;
    try {
      const { data } = await api.patch<Message>(`/messages/${editingMessage.id}`, { content });
      dispatch(updateMessage(data));
      setEditingMessage(null);
      setDraft("");
    } catch {
      // leave the draft in place so the user can retry
    }
  }

  async function deleteForMe(message: Message) {
    try {
      await api.delete(`/messages/${message.id}/me`);
      dispatch(removeMessageLocal({ chatId: message.chatId, messageId: message.id }));
    } catch {
      // no-op — leave the message visible if the request failed
    }
  }

  async function deleteForEveryone(message: Message) {
    try {
      const { data } = await api.delete<Message>(`/messages/${message.id}`);
      dispatch(updateMessage(data));
    } catch {
      // no-op
    }
  }

  async function toggleStar(message: Message) {
    try {
      const { data } = await api.post<{ starred: boolean }>(`/messages/${message.id}/star`);
      dispatch(updateMessage({
        ...message,
        starredBy: data.starred && me ? [{ userId: me.id }] : [],
      }));
    } catch {
      // no-op
    }
  }

  async function togglePin(message: Message) {
    if (!chat) return;
    try {
      const { data } = chat.pinnedMessageId === message.id
        ? await api.delete<Chat>(`/chats/${chat.id}/pin`)
        : await api.post<Chat>(`/chats/${chat.id}/pin`, { messageId: message.id });
      dispatch(upsertChat(data));
    } catch {
      // no-op
    }
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
    <section
      className="flex-1 flex flex-col h-full bg-ink relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
      }}
    >
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ink/80 border-2 border-dashed border-accent text-accent text-sm pointer-events-none">
          Drop to send
        </div>
      )}

      <header className="flex items-center gap-3 px-4 py-3 border-b border-surface bg-panel">
        <button
          onClick={() => dispatch(setActiveChat(null))}
          className="sm:hidden w-9 h-9 -ml-1 rounded-lg hover:bg-surface flex items-center justify-center text-xl shrink-0"
          title="Back to chats"
        >
          ←
        </button>
        <div
          className={`flex items-center gap-3 flex-1 min-w-0 ${
            chat.isGroup ? "cursor-pointer hover:bg-surface/40 rounded-lg -mx-1 px-1" : ""
          }`}
          onClick={() => chat.isGroup && setGroupInfoOpen(true)}
        >
          <Avatar name={title} src={chat.iconUrl} size={40} online={chat.isGroup ? undefined : online} isGroup={chat.isGroup} />
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{title}</div>
            <div className="text-xs text-muted truncate">
              {chat.isGroup
                ? `${chat.members.length} member${chat.members.length === 1 ? "" : "s"}`
                : someoneTyping ? "typing…" : online ? "online" : other ? "offline" : ""}
            </div>
          </div>
        </div>
        {!chat.isGroup && other && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => placeCall("voice")}
              disabled={call.callState.status !== "idle"}
              className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-lg disabled:opacity-40 disabled:cursor-not-allowed"
              title="Voice call"
            >
              📞
            </button>
            <button
              onClick={() => placeCall("video")}
              disabled={call.callState.status !== "idle"}
              className="w-9 h-9 rounded-lg hover:bg-surface flex items-center justify-center text-lg disabled:opacity-40 disabled:cursor-not-allowed"
              title="Video call"
            >
              🎥
            </button>
          </div>
        )}
      </header>

      {chat.isGroup && groupInfoOpen && (
        <GroupInfoModal chat={chat} onClose={() => setGroupInfoOpen(false)} />
      )}

      {forwardingMessage && (
        <ForwardMessageModal message={forwardingMessage} onClose={() => setForwardingMessage(null)} />
      )}

      {chat.pinnedMessage && (
        <div className="flex items-center gap-2 px-4 py-2 bg-panel border-b border-surface text-sm">
          <span className="text-accent shrink-0">📌</span>
          <span className="flex-1 min-w-0 truncate text-muted">
            {chat.pinnedMessage.isDeleted
              ? "This message was deleted"
              : chat.pinnedMessage.content ?? "Attachment"}
          </span>
          {(!chat.isGroup || isAdmin) && (
            <button
              onClick={() => togglePin(chat.pinnedMessage!)}
              className="text-muted hover:text-fg text-xs shrink-0"
              title="Unpin"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-4 space-y-1.5">
        {chatMessages.map((m) => {
          const isMine = m.senderId === me?.id;
          const canDeleteForEveryone = !m.isDeleted && (isMine || (chat.isGroup && isAdmin));
          const canPin = !m.isDeleted && (!chat.isGroup || isAdmin);
          const starred = !!m.starredBy?.some((s) => s.userId === me?.id);
          return (
            <MessageBubble
              key={m.id}
              message={m}
              mine={isMine}
              readByOther={!!m.receipts?.some((r) => r.userId !== me?.id)}
              showSender={chat.isGroup && m.senderId !== me?.id}
              starred={starred}
              isPinned={chat.pinnedMessageId === m.id}
              onEdit={isMine && !m.isDeleted && m.type === "TEXT" ? () => startEdit(m) : undefined}
              onDeleteForMe={!m.isDeleted ? () => deleteForMe(m) : undefined}
              onDeleteForEveryone={canDeleteForEveryone ? () => deleteForEveryone(m) : undefined}
              onForward={!m.isDeleted ? () => setForwardingMessage(m) : undefined}
              onToggleStar={!m.isDeleted ? () => toggleStar(m) : undefined}
              onTogglePin={canPin ? () => togglePin(m) : undefined}
            />
          );
        })}
        {chatPendingUploads.map((u) => (
          <PendingBubble key={u.id} item={u} />
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
        {editingMessage && (
          <div className="flex items-center gap-2 px-2 pb-2 text-xs text-muted">
            <span className="flex-1">✏️ Editing message</span>
            <button onClick={cancelEdit} className="hover:text-fg">✕ Cancel</button>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {recording ? (
          <div className="flex items-center gap-3 bg-ink border border-surface rounded-2xl px-4 py-2.5">
            <button
              type="button"
              onClick={cancelRecording}
              className="text-muted hover:text-fg transition"
              title="Cancel recording"
            >🗑</button>
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse shrink-0" />
            <span className="text-sm text-fg flex-1">{formatTime(recordSeconds)}</span>
            <button
              type="button"
              onClick={stopRecording}
              className="w-9 h-9 shrink-0 rounded-full bg-accent hover:bg-accent-dim text-accent-fg flex items-center justify-center transition"
              title="Stop and send"
            >⏹</button>
          </div>
        ) : (
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!!editingMessage}
              className="w-9 h-9 shrink-0 rounded-full hover:bg-surface text-lg flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Attach file"
            >📎</button>
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                if (e.key === "Escape" && editingMessage) cancelEdit();
              }}
              placeholder={editingMessage ? "Edit message" : "Type a message"}
              className="flex-1 resize-none bg-ink border border-surface rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60 max-h-32"
            />
            <button
              type="button"
              onClick={startRecording}
              disabled={!!editingMessage}
              className="w-9 h-9 shrink-0 rounded-full hover:bg-surface text-lg flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
              title="Record voice note"
            >🎤</button>
            <button
              onClick={handleSubmit}
              className="w-11 h-11 shrink-0 rounded-full bg-accent hover:bg-accent-dim text-accent-fg flex items-center justify-center text-lg transition"
            >{editingMessage ? "✓" : "➤"}</button>
          </div>
        )}
      </footer>
    </section>
  );
}

function PendingBubble({ item }: { item: PendingUpload }) {
  return (
    <div className="flex justify-end px-4">
      <div className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow bg-accent text-accent-fg rounded-br-md opacity-70">
        {item.previewUrl && item.type === "IMAGE" && (
          <img src={item.previewUrl} className="block max-w-[200px] max-h-56 rounded-lg mb-1" />
        )}
        {item.previewUrl && item.type === "VIDEO" && (
          <video src={item.previewUrl} className="block max-w-[200px] rounded-lg mb-1" />
        )}
        <div className="flex items-center gap-2 text-xs">
          {!item.error && <span className="w-3 h-3 border-2 border-accent-fg/40 border-t-accent-fg rounded-full animate-spin shrink-0" />}
          <span className="truncate max-w-[180px]">
            {item.error ? "Upload failed" : `Uploading ${item.fileName}…`}
          </span>
        </div>
      </div>
    </div>
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
