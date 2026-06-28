import { Avatar } from "./Avatar";
import type { CallContextValue } from "../hooks/CallContext";

export function IncomingCallScreen({ call }: { call: CallContextValue }) {
  const { callState, acceptCall, rejectCall } = call;
  const { peer, callType } = callState;
  if (!peer) return null;

  return (
    <div className="fixed inset-0 z-30 bg-ink flex flex-col items-center justify-center text-gray-100 gap-6">
      <Avatar name={peer.displayName} src={peer.avatarUrl} size={120} />
      <div className="text-center">
        <div className="text-xl font-semibold">{peer.displayName}</div>
        <div className="text-sm text-muted mt-1">
          Incoming {callType === "video" ? "video" : "voice"} call…
        </div>
      </div>
      <div className="flex items-center gap-8">
        <button
          onClick={rejectCall}
          className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-2xl transition"
          title="Decline"
        >
          ✕
        </button>
        <button
          onClick={acceptCall}
          className="w-16 h-16 rounded-full bg-accent hover:bg-accent-dim text-ink flex items-center justify-center text-2xl transition"
          title="Accept"
        >
          {callType === "video" ? "🎥" : "📞"}
        </button>
      </div>
    </div>
  );
}
