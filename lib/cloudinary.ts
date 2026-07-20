export const CLOUDINARY_CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "activation";

/**
 * Builds a face-cropped, auto-format Cloudinary delivery URL from a public ID.
 * Use this when uploading a new ambassador headshot to Cloudinary — paste the
 * resulting URL into the `headshot_url` column in Supabase.
 */
export function cloudinaryHeadshotUrl(publicId: string, size = 400): string {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/c_fill,g_face,w_${size},h_${size},q_auto,f_auto/${publicId}`;
}
