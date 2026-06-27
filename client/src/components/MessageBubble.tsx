import type { Message } from "../types";
import { Avatar } from "./Avatar";

export function MessageBubble({
  message,
  mine,
  readByOther = false,
  showSender = false,
}: {
  message: Message;
  mine: boolean;
  readByOther?: boolean;
  showSender?: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} px-4 gap-2`}>
      {showSender && (
        <Avatar name={message.sender?.displayName ?? "?"} src={message.sender?.avatarUrl} size={28} />
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
        <span className={`ml-2 align-bottom text-[10px] ${mine ? "text-ink/60" : "text-muted"}`}>
          {time}
          {mine && (
            <span className={`ml-1 font-semibold ${readByOther ? "text-blue-700" : "text-ink/50"}`}>
              {readByOther ? "✓✓" : "✓"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
