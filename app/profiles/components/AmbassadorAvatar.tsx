"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

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
  eager = false,
  rounded = "rounded-lg",
  className = "",
}: {
  src: string | null;
  name: string;
  size?: number;
  /** Load immediately (above-the-fold photos) instead of lazily. */
  eager?: boolean;
  rounded?: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const showFallback = !src || errored;

  // A cached or eager image can finish loading before React hydrates, in which
  // case onLoad never fires — check `complete` so it doesn't stay invisible.
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) setLoaded(true);
  }, [src]);

  return (
    <div
      className={`relative ${rounded} overflow-hidden border border-ink/5 shadow-soft bg-mist flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {showFallback ? (
        <span className="font-display font-extrabold tracking-tight text-ink/40" style={{ fontSize: size * 0.32 }}>
          {initials(name)}
        </span>
      ) : (
        <Image
          ref={imgRef}
          src={src}
          alt={name}
          fill
          sizes={`${size}px`}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          className={`object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          // Headshots are portrait crops — keep faces in frame when squared off.
          style={{ objectPosition: "50% 22%" }}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
