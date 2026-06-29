import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAppDispatch } from "../store/hooks";
import { setStatusFeed } from "../store/slices/statusSlice";
import { Avatar } from "./Avatar";
import { relativeTime } from "../utils/time";
import type { StatusFeed, StatusGroup } from "../types";

const IMAGE_DURATION_MS = 5000;

export function StatusViewer({
  group,
  isOwn,
  onClose,
}: {
  group: StatusGroup;
  isOwn: boolean;
  onClose: () => void;
}) {
  const dispatch = useAppDispatch();
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = group.statuses[index];

  useEffect(() => {
    if (!current) return;
    if (!isOwn) api.post(`/statuses/${current.id}/view`).catch(() => {});

    if (current.mediaType === "VIDEO") return; // advance handled by the video's onEnded
    timerRef.current = setTimeout(advance, IMAGE_DURATION_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  function advance() {
    if (index < group.statuses.length - 1) setIndex((i) => i + 1);
    else close();
  }

  function back() {
    if (index > 0) setIndex((i) => i - 1);
  }

  // Refresh the feed once on close so ring/unseen state updates after watching.
  function close() {
    api.get<StatusFeed>("/statuses").then((r) => dispatch(setStatusFeed(r.data))).catch(() => {});
    onClose();
  }

  async function handleDelete() {
    if (!current) return;
    await api.delete(`/statuses/${current.id}`).catch(() => {});
    close();
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-30 bg-ink flex flex-col">
      <div className="flex gap-1 px-3 pt-3">
        {group.statuses.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 rounded-full bg-fg/30 overflow-hidden">
            <div className="h-full bg-fg" style={{ width: i <= index ? "100%" : "0%" }} />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 text-fg">
        <Avatar name={group.user.displayName} src={group.user.avatarUrl} size={32} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{isOwn ? "My status" : group.user.displayName}</div>
          <div className="text-xs text-fg/60">{relativeTime(current.createdAt)}</div>
        </div>
        <button onClick={close} className="text-fg/80 hover:text-fg text-xl px-2">✕</button>
      </div>

      <div
        className="flex-1 relative flex items-center justify-center"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          if (x < rect.width / 3) back();
          else advance();
        }}
      >
        {current.mediaType === "IMAGE" ? (
          <img src={current.mediaUrl} className="max-h-full max-w-full object-contain" />
        ) : (
          <video
            key={current.id}
            src={current.mediaUrl}
            autoPlay
            playsInline
            className="max-h-full max-w-full object-contain"
            onEnded={advance}
          />
        )}
      </div>

      {current.caption && (
        <div className="px-4 py-3 text-center text-fg text-sm">{current.caption}</div>
      )}

      {isOwn && (
        <div className="flex items-center justify-between px-4 py-3 text-fg/80 text-xs">
          <span>👁 {current.viewCount} view{current.viewCount === 1 ? "" : "s"}</span>
          <button onClick={handleDelete} className="text-danger hover:text-danger-dim">🗑 Delete</button>
        </div>
      )}
    </div>
  );
}
