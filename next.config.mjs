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
  // Baked into the client bundle at build time and also served by /api/version, so an
  // open tab can tell when a newer deployment is live (see UpdateBanner). Unset locally,
  // which turns the banner off in dev.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "",
  },
  images: {
    remotePatterns,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
};
export default nextConfig;
