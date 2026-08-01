import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sidelick.app";

/**
 * Only marketing/entry pages are crawlable. Everything behind auth (the app
 * itself, account flows, walker profiles) is disallowed so it stays out of
 * search results.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/signup", "/signin"],
      disallow: [
        "/dashboard",
        "/bookings",
        "/pets",
        "/profile",
        "/settings",
        "/onboarding",
        "/admin",
        "/walkers",
        "/unauthorized",
        "/forgot-password",
        "/reset-password",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
