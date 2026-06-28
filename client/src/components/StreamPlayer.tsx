import { useEffect, useRef } from "react";

// Binds a MediaStream to a <video> element. Used for both video previews and
// for playing remote audio-only streams (kept in the DOM but visually hidden).
export function StreamPlayer({
  stream,
  muted = false,
  hidden = false,
  className = "",
}: {
  stream: MediaStream | null;
  muted?: boolean;
  hidden?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={hidden ? "hidden" : className}
    />
  );
}
