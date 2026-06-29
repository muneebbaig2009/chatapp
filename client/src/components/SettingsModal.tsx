import { useRef, useState } from "react";
import { api } from "../api/client";
import { uploadToCloudinary } from "../api/cloudinary";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setUser } from "../store/slices/authSlice";
import { useTheme } from "../utils/theme";
import { Avatar } from "./Avatar";
import type { User } from "../types";

function Toggle({
  checked, onChange, label, hint,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-2 gap-3">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="text-xs text-muted">{hint}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition ${checked ? "bg-accent" : "bg-surface"}`}
        title={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-accent-fg transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const me = useAppSelector((s) => s.auth.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, toggleTheme } = useTheme();

  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [about, setAbout] = useState(me?.about ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(me?.avatarUrl ?? null);
  const [showLastSeen, setShowLastSeen] = useState(me?.showLastSeen ?? true);
  const [showOnlineStatus, setShowOnlineStatus] = useState(me?.showOnlineStatus ?? true);
  const [showReadReceipts, setShowReadReceipts] = useState(me?.showReadReceipts ?? true);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleAvatarPick(file: File) {
    setUploading(true);
    setError("");
    try {
      const { url } = await uploadToCloudinary(file);
      setAvatarUrl(url);
    } catch {
      setError("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Display name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data } = await api.patch<User>("/users/me", {
        displayName: trimmed,
        about,
        avatarUrl,
        showLastSeen,
        showOnlineStatus,
        showReadReceipts,
      });
      dispatch(setUser(data));
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-panel border border-surface rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-surface flex items-center justify-between">
          <h2 className="font-semibold text-sm">Settings</h2>
          <button onClick={onClose} className="text-muted hover:text-fg">✕</button>
        </header>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Avatar name={displayName || "?"} src={avatarUrl} size={88} />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent text-accent-fg flex items-center justify-center text-sm ring-2 ring-panel disabled:opacity-60"
                title="Change photo"
              >
                {uploading ? "…" : "📷"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleAvatarPick(e.target.files[0])}
              />
            </div>
          </div>

          <label className="block">
            <span className="text-xs text-muted mb-1 block">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={50}
              className="w-full bg-ink border border-surface rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
          </label>

          <label className="block">
            <span className="text-xs text-muted mb-1 block">About</span>
            <input
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              maxLength={150}
              className="w-full bg-ink border border-surface rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
          </label>

          <div className="border-t border-surface pt-3">
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Appearance</div>
            <Toggle
              label={theme === "dark" ? "Dark mode" : "Light mode"}
              hint="Switch between dark and light theme"
              checked={theme === "dark"}
              onChange={toggleTheme}
            />
          </div>

          <div className="border-t border-surface pt-3">
            <div className="text-xs text-muted uppercase tracking-wide mb-1">Privacy</div>
            <Toggle
              label="Last seen"
              hint="Let others see when you were last online"
              checked={showLastSeen}
              onChange={setShowLastSeen}
            />
            <Toggle
              label="Online status"
              hint="Let others see when you're online now"
              checked={showOnlineStatus}
              onChange={setShowOnlineStatus}
            />
            <Toggle
              label="Read receipts"
              hint="Let others see when you've read their messages"
              checked={showReadReceipts}
              onChange={setShowReadReceipts}
            />
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <footer className="p-3 border-t border-surface">
          <button
            disabled={saving || uploading}
            onClick={save}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-accent-fg font-medium rounded-lg py-2 text-sm transition"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}
