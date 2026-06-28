import { useRef, useState } from "react";
import { api } from "../api/client";
import { uploadToCloudinary } from "../api/cloudinary";
import { useAppDispatch } from "../store/hooks";
import { setStatusFeed } from "../store/slices/statusSlice";
import type { StatusFeed, StatusMediaType } from "../types";

export function CreateStatusModal({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<StatusMediaType | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pickFile(f: File) {
    setFile(f);
    setMediaType(f.type.startsWith("video/") ? "VIDEO" : "IMAGE");
    setPreviewUrl(URL.createObjectURL(f));
  }

  async function post() {
    if (!file || !mediaType) return;
    setBusy(true);
    setError("");
    try {
      const { url } = await uploadToCloudinary(file);
      await api.post("/statuses", { mediaUrl: url, mediaType, caption: caption.trim() || undefined });
      const { data } = await api.get<StatusFeed>("/statuses");
      dispatch(setStatusFeed(data));
      onClose();
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Failed to post status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-panel border border-surface rounded-2xl w-full max-w-sm flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-4 py-3 border-b border-surface flex items-center justify-between">
          <h2 className="font-semibold text-sm">New status</h2>
          <button onClick={onClose} className="text-muted hover:text-gray-200">✕</button>
        </header>

        <div className="p-4 space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])}
          />

          {previewUrl ? (
            <div className="rounded-xl overflow-hidden bg-ink max-h-64 flex items-center justify-center">
              {mediaType === "IMAGE" ? (
                <img src={previewUrl} className="max-h-64 w-full object-contain" />
              ) : (
                <video src={previewUrl} controls className="max-h-64 w-full object-contain" />
              )}
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 rounded-xl border-2 border-dashed border-surface hover:border-accent/60 flex items-center justify-center text-muted text-sm transition"
            >
              📷 Tap to choose a photo or video
            </button>
          )}

          {previewUrl && (
            <input
              placeholder="Add a caption (optional)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-ink border border-surface rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
          )}

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <footer className="p-3 border-t border-surface">
          <button
            disabled={!file || busy}
            onClick={post}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 disabled:cursor-not-allowed text-ink font-medium rounded-lg py-2 text-sm transition"
          >
            {busy ? "Posting…" : "Post status"}
          </button>
        </footer>
      </div>
    </div>
  );
}
