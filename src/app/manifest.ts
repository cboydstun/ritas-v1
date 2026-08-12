import type { MetadataRoute } from "next";

/**
 * The favicon set in `public/favicon/` already carried the 192 and 512 icons a
 * manifest needs; without this file none of it was usable as an install
 * target, and Android had no icon or theme colour to work with.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SATX Ritas Rentals",
    short_name: "SATX Ritas",
    description:
      "Frozen drink and margarita machine rentals in San Antonio, TX — delivery, setup and pickup included.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#4b7a0a",
    icons: [
      {
        src: "/favicon/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/favicon/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
