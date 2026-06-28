import { useAppSelector } from "../store/hooks";
import { useCall } from "../hooks/CallContext";
import { Avatar } from "./Avatar";
import { relativeTime } from "../utils/time";
import type { CallLogEntry } from "../types";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Missed is only shown in red from the recipient's side — an unanswered
// outgoing call is "no answer" for the caller, not a "missed call".
function statusLabel(entry: CallLogEntry): { text: string; className: string } {
  if (entry.status === "MISSED") {
    return entry.direction === "incoming"
      ? { text: "Missed call", className: "text-red-400" }
      : { text: "No answer", className: "text-muted" };
  }
  if (entry.status === "REJECTED") {
    return { text: entry.direction === "incoming" ? "Declined" : "Call declined", className: "text-muted" };
  }
  if (entry.status === "CANCELLED") {
    return { text: "Cancelled", className: "text-muted" };
  }
  return { text: formatDuration(entry.durationSeconds ?? 0), className: "text-muted" };
}

export function CallHistoryList() {
  const log = useAppSelector((s) => s.calls.log);
  const call = useCall();

  function placeCall(entry: CallLogEntry) {
    if (!entry.chatId || call.callState.status !== "idle") return;
    call.startCall(entry.chatId, entry.otherUser, entry.callType === "VIDEO" ? "video" : "voice");
  }

  if (log.length === 0) {
    return <p className="text-sm text-muted text-center mt-10 px-6">No calls yet.</p>;
  }

  return (
    <div>
      {log.map((entry) => {
        const { text, className } = statusLabel(entry);
        const isMissed = entry.status === "MISSED" && entry.direction === "incoming";
        const canCall = !!entry.chatId && call.callState.status === "idle";
        return (
          <button
            key={entry.id}
            onClick={() => placeCall(entry)}
            disabled={!canCall}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition disabled:cursor-default"
          >
            <Avatar name={entry.otherUser.displayName} src={entry.otherUser.avatarUrl} size={44} />
            <div className="min-w-0 flex-1">
              <div className={`font-medium text-sm truncate ${isMissed ? "text-red-400" : ""}`}>
                {entry.otherUser.displayName}
              </div>
              <div className={`text-xs truncate flex items-center gap-1 ${className}`}>
                <span>{entry.direction === "outgoing" ? "↗" : "↙"}</span>
                <span>{entry.callType === "VIDEO" ? "🎥" : "📞"}</span>
                <span>{text}</span>
              </div>
            </div>
            <div className="text-xs text-muted shrink-0">{relativeTime(entry.createdAt)}</div>
          </button>
        );
      })}
    </div>
  );
}
