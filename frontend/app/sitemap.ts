import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sidelick.app";

/** Public, indexable routes only — the app pages sit behind auth. */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: siteUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/signup`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/signin`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
