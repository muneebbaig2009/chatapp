import type { Message } from "../types";

export function MessageBubble({
  message,
  mine,
  readByOther = false,
}: {
  message: Message;
  mine: boolean;
  readByOther?: boolean;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"} px-4`}>
      <div
        className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow ${
          mine
            ? "bg-accent text-ink rounded-br-md"
            : "bg-bubble text-gray-100 rounded-bl-md"
        }`}
      >
        {message.replyTo?.content && (
          <div className={`text-xs mb-1 pl-2 border-l-2 ${mine ? "border-ink/40 text-ink/70" : "border-accent text-muted"}`}>
            {message.replyTo.content}
          </div>
        )}
        <span className="whitespace-pre-wrap break-words">{message.content}</span>
        <span className={`ml-2 align-bottom text-[10px] ${mine ? "text-ink/60" : "text-muted"}`}>
          {time}
          {mine && (
            <span className={`ml-1 ${readByOther ? "text-blue-600" : "text-ink/50"}`}>
              {readByOther ? "✓✓" : "✓"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}