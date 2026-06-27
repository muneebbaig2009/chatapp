interface Props {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
}

// Initials avatar with a deterministic teal tint and optional presence dot.
export function Avatar({ name, src, size = 40, online }: Props) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="rounded-full bg-surface flex items-center justify-center font-semibold text-accent"
          style={{ width: size, height: size, fontSize: size * 0.4 }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-panel ${
            online ? "bg-accent" : "bg-gray-500"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
