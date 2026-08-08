import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Greenline Activations",
    short_name: "Greenline",
    description: "Greenline Activations client dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#faf0ea",
    theme_color: "#00c853",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
