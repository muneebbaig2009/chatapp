import { Avatar } from "./Avatar";
import { StreamPlayer } from "./StreamPlayer";
import type { CallContextValue } from "../hooks/CallContext";

export function InCallScreen({ call }: { call: CallContextValue }) {
  const {
    callState, localStream, remoteStream, isMuted, isCameraOff,
    toggleMute, toggleCamera, hangUp,
  } = call;
  const { peer, callType, status } = callState;
  if (!peer) return null;

  const isVideo = callType === "video";
  const statusLabel = status === "active" ? "On call" : "Connecting…";

  return (
    <div className="fixed inset-0 z-30 bg-ink flex flex-col text-fg">
      <div className="px-4 py-3 text-center text-sm text-muted border-b border-surface">
        {peer.displayName} · {statusLabel}
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isVideo ? (
          <>
            <StreamPlayer stream={remoteStream} className="w-full h-full object-cover bg-ink" />
            <div className="absolute bottom-4 right-4 w-32 h-44 rounded-xl overflow-hidden border border-surface shadow-lg bg-panel">
              <StreamPlayer stream={localStream} muted className="w-full h-full object-cover" />
            </div>
          </>
        ) : (
          <>
            <Avatar name={peer.displayName} src={peer.avatarUrl} size={140} />
            <StreamPlayer stream={remoteStream} hidden />
          </>
        )}
      </div>

      <div className="flex items-center justify-center gap-6 px-4 py-6 bg-panel border-t border-surface">
        <button
          onClick={toggleMute}
          className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition ${
            isMuted ? "bg-surface text-accent" : "bg-surface hover:bg-surface/70"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? "🔇" : "🎙️"}
        </button>
        {isVideo && (
          <button
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-full flex items-center justify-center text-xl transition ${
              isCameraOff ? "bg-surface text-accent" : "bg-surface hover:bg-surface/70"
            }`}
            title={isCameraOff ? "Turn camera on" : "Turn camera off"}
          >
            {isCameraOff ? "📷" : "🎥"}
          </button>
        )}
        <button
          onClick={hangUp}
          className="w-14 h-14 rounded-full bg-danger hover:bg-danger-dim flex items-center justify-center text-xl transition"
          title="Hang up"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
