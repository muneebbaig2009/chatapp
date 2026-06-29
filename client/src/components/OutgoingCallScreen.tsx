import { Avatar } from "./Avatar";
import type { CallContextValue } from "../hooks/CallContext";

export function OutgoingCallScreen({ call }: { call: CallContextValue }) {
  const { callState, hangUp } = call;
  const { peer, callType, status } = callState;
  if (!peer) return null;

  return (
    <div className="fixed inset-0 z-30 bg-ink flex flex-col items-center justify-center text-fg gap-6">
      <Avatar name={peer.displayName} src={peer.avatarUrl} size={120} />
      <div className="text-center">
        <div className="text-xl font-semibold">{peer.displayName}</div>
        <div className="text-sm text-muted mt-1">
          {status === "connecting" ? "Connecting…" : `Calling… (${callType === "video" ? "video" : "voice"})`}
        </div>
      </div>
      <button
        onClick={hangUp}
        className="w-16 h-16 rounded-full bg-danger hover:bg-danger-dim flex items-center justify-center text-2xl transition"
        title="Cancel"
      >
        ✕
      </button>
    </div>
  );
}
