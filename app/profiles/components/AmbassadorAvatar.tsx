"use client";

import { useState } from "react";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AmbassadorAvatar({
  src,
  name,
  size = 96,
  className = "",
}: {
  src: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const showFallback = !src || errored;

  return (
    <div
      className={`rounded-lg overflow-hidden border border-ink/5 shadow-card bg-mist flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {showFallback ? (
        <span
          className="font-bold tracking-tight text-ink/60"
          style={{ fontSize: size * 0.32 }}
        >
          {initials(name)}
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={name}
          width={size}
          height={size}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
