import { useState } from "react";
import { useAppSelector } from "../store/hooks";
import { Avatar } from "./Avatar";
import { CreateStatusModal } from "./CreateStatusModal";
import { StatusViewer } from "./StatusViewer";
import { relativeTime } from "../utils/time";
import type { StatusGroup } from "../types";

export function StatusList() {
  const mine = useAppSelector((s) => s.status.mine);
  const others = useAppSelector((s) => s.status.others);
  const me = useAppSelector((s) => s.auth.user);
  const [creating, setCreating] = useState(false);
  const [viewingGroup, setViewingGroup] = useState<StatusGroup | null>(null);
  const [viewingIsOwn, setViewingIsOwn] = useState(false);

  function openMine() {
    if (mine) {
      setViewingGroup(mine);
      setViewingIsOwn(true);
    } else {
      setCreating(true);
    }
  }

  function openOther(group: StatusGroup) {
    setViewingGroup(group);
    setViewingIsOwn(false);
  }

  return (
    <div>
      <button
        onClick={openMine}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition"
      >
        <div className="relative shrink-0">
          <Avatar name={me?.displayName ?? "Me"} src={me?.avatarUrl} size={48} />
          {mine && <span className="absolute inset-0 rounded-full ring-2 ring-accent" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setCreating(true);
            }}
            className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent text-accent-fg flex items-center justify-center text-xs font-bold ring-2 ring-panel"
            title="Add status"
          >
            +
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm">My status</div>
          <div className="text-xs text-muted truncate">
            {mine ? relativeTime(mine.statuses[mine.statuses.length - 1].createdAt) : "Tap to add a status update"}
          </div>
        </div>
      </button>

      {others.length > 0 && (
        <div className="px-4 pt-2 pb-1 text-xs text-muted uppercase tracking-wide">Recent updates</div>
      )}
      {others.map((group) => (
        <button
          key={group.user.id}
          onClick={() => openOther(group)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface transition"
        >
          <div className="relative shrink-0">
            <Avatar name={group.user.displayName} src={group.user.avatarUrl} size={48} />
            <span className={`absolute inset-0 rounded-full ring-2 ${group.hasUnseen ? "ring-accent" : "ring-muted/40"}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm truncate">{group.user.displayName}</div>
            <div className="text-xs text-muted truncate">
              {relativeTime(group.statuses[group.statuses.length - 1].createdAt)}
            </div>
          </div>
        </button>
      ))}

      {others.length === 0 && !mine && (
        <p className="text-sm text-muted text-center mt-10 px-6">No status updates yet.</p>
      )}

      {creating && <CreateStatusModal onClose={() => setCreating(false)} />}
      {viewingGroup && (
        <StatusViewer group={viewingGroup} isOwn={viewingIsOwn} onClose={() => setViewingGroup(null)} />
      )}
    </div>
  );
}
