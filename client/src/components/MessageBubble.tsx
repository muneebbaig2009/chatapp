import { useState } from "react";
import type { Message } from "../types";
import { Avatar } from "./Avatar";

interface Props {
  message: Message;
  mine: boolean;
  readByOther?: boolean;
  showSender?: boolean;
  starred?: boolean;
  isPinned?: boolean;
  onEdit?: () => void;
  onDeleteForMe?: () => void;
  onDeleteForEveryone?: () => void;
  onForward?: () => void;
  onToggleStar?: () => void;
  onTogglePin?: () => void;
}

export function MessageBubble({
  message,
  mine,
  readByOther = false,
  showSender = false,
  starred = false,
  isPinned = false,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  onForward,
  onToggleStar,
  onTogglePin,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasActions = !message.isDeleted && (onEdit || onDeleteForMe || onDeleteForEveryone || onForward || onToggleStar || onTogglePin);

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} px-4 gap-2 group`}>
      {showSender && (
        <Avatar name={message.sender?.displayName ?? "?"} src={message.sender?.avatarUrl} size={28} />
      )}

      {mine && hasActions && (
        <MessageMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          starred={starred}
          isPinned={isPinned}
          onEdit={onEdit}
          onDeleteForMe={onDeleteForMe}
          onDeleteForEveryone={onDeleteForEveryone}
          onForward={onForward}
          onToggleStar={onToggleStar}
          onTogglePin={onTogglePin}
        />
      )}

      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow ${
          mine
            ? "bg-accent text-ink rounded-br-md"
            : "bg-bubble text-gray-100 rounded-bl-md"
        }`}
      >
        {showSender && (
          <div className="text-xs font-semibold text-accent mb-0.5">
            {message.sender?.displayName}
          </div>
        )}

        {isPinned && (
          <div className={`text-[11px] mb-1 flex items-center gap-1 ${mine ? "text-ink/60" : "text-muted"}`}>
            📌 Pinned
          </div>
        )}
        {message.forwardedFromId && (
          <div className={`text-[11px] mb-1 italic flex items-center gap-1 ${mine ? "text-ink/60" : "text-muted"}`}>
            ↪ Forwarded
          </div>
        )}

        {message.isDeleted ? (
          <span className={`italic text-sm ${mine ? "text-ink/60" : "text-muted"}`}>
            This message was deleted
          </span>
        ) : (
          <>
            {message.replyTo?.content && (
              <div className={`text-xs mb-1 pl-2 border-l-2 ${mine ? "border-ink/40 text-ink/70" : "border-accent text-muted"}`}>
                {message.replyTo.content}
              </div>
            )}

            {message.type === "IMAGE" && message.fileUrl && (
              <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={message.fileUrl}
                  alt={message.fileName ?? "image"}
                  className="block max-w-[260px] max-h-72 w-auto rounded-lg object-cover mb-1 cursor-pointer"
                />
              </a>
            )}

            {message.type === "VIDEO" && message.fileUrl && (
              <video
                controls
                src={message.fileUrl}
                className="block max-w-[260px] rounded-lg mb-1"
              />
            )}

            {(message.type === "AUDIO" || message.type === "VOICE") && message.fileUrl && (
              <audio controls src={message.fileUrl} className="block max-w-[240px] mb-1" />
            )}

            {message.type === "FILE" && message.fileUrl && (
              <a
                href={message.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={message.fileName ?? undefined}
                className={`flex items-center gap-2 mb-1 px-2 py-1.5 rounded-lg ${
                  mine ? "bg-ink/10 hover:bg-ink/20" : "bg-ink/30 hover:bg-ink/40"
                }`}
              >
                <span className="text-xl">📄</span>
                <span className="text-sm truncate max-w-[160px]">{message.fileName ?? "File"}</span>
              </a>
            )}

            {message.content && (
              <span className="whitespace-pre-wrap break-words">{message.content}</span>
            )}
          </>
        )}

        <span className={`ml-2 align-bottom text-[10px] ${mine ? "text-ink/60" : "text-muted"}`}>
          {starred && <span className="mr-1">⭐</span>}
          {message.isEdited && !message.isDeleted && <span className="mr-1">edited</span>}
          {time}
          {mine && (
            <span className={`ml-1 font-semibold ${readByOther ? "text-blue-700" : "text-ink/50"}`}>
              {readByOther ? "✓✓" : "✓"}
            </span>
          )}
        </span>
      </div>

      {!mine && hasActions && (
        <MessageMenu
          open={menuOpen}
          onOpenChange={setMenuOpen}
          starred={starred}
          isPinned={isPinned}
          onEdit={onEdit}
          onDeleteForMe={onDeleteForMe}
          onDeleteForEveryone={onDeleteForEveryone}
          onForward={onForward}
          onToggleStar={onToggleStar}
          onTogglePin={onTogglePin}
        />
      )}
    </div>
  );
}

function MessageMenu({
  open, onOpenChange, starred, isPinned, onEdit, onDeleteForMe, onDeleteForEveryone, onForward, onToggleStar, onTogglePin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  starred: boolean;
  isPinned: boolean;
} & Pick<Props, "onEdit" | "onDeleteForMe" | "onDeleteForEveryone" | "onForward" | "onToggleStar" | "onTogglePin">) {
  function act(fn?: () => void) {
    onOpenChange(false);
    fn?.();
  }

  return (
    <div className="relative self-start shrink-0">
      <button
        onClick={() => onOpenChange(!open)}
        className="w-6 h-6 rounded-full opacity-0 group-hover:opacity-100 hover:bg-surface flex items-center justify-center text-muted text-sm transition"
        title="Message actions"
      >
        ⋮
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => onOpenChange(false)} />
          <div className="absolute right-0 mt-1 w-44 bg-panel border border-surface rounded-lg shadow-lg z-20 overflow-hidden">
            {onEdit && (
              <button onClick={() => act(onEdit)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface">✏️ Edit</button>
            )}
            {onToggleStar && (
              <button onClick={() => act(onToggleStar)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface">
                {starred ? "⭐ Unstar" : "☆ Star"}
              </button>
            )}
            {onTogglePin && (
              <button onClick={() => act(onTogglePin)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface">
                {isPinned ? "📌 Unpin" : "📌 Pin"}
              </button>
            )}
            {onForward && (
              <button onClick={() => act(onForward)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface">↪ Forward</button>
            )}
            {onDeleteForMe && (
              <button onClick={() => act(onDeleteForMe)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface text-muted">
                🗑 Delete for me
              </button>
            )}
            {onDeleteForEveryone && (
              <button onClick={() => act(onDeleteForEveryone)} className="w-full text-left px-3 py-2 text-sm hover:bg-surface text-red-400">
                🗑 Delete for everyone
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
