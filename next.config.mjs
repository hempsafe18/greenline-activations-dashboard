// Ambassador headshots are full-size uploads in Supabase Storage (or Cloudinary).
// next/image resizes + re-encodes them on demand so the directory ships ~10-20KB
// WebP/AVIF thumbnails instead of multi-megabyte originals.
const remotePatterns = [{ protocol: "https", hostname: "res.cloudinary.com" }];

try {
  const supabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  remotePatterns.push({
    protocol: supabase.protocol.replace(":", ""),
    hostname: supabase.hostname,
    ...(supabase.port ? { port: supabase.port } : {}),
    pathname: "/storage/v1/object/public/**",
  });
} catch {
  // NEXT_PUBLIC_SUPABASE_URL unset (e.g. a bare build) — headshots fall back to initials.
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};
export default nextConfig;
