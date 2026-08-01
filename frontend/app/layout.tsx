import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppNav } from "../components/nav/AppNav";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sidelick.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Sidelick — Trusted dog walking & sitting",
    template: "%s · Sidelick",
  },
  description:
    "Book verified dog walkers and sitters — walks, daycare, and travel sitting from one trusted person. Serving Beirut and the Gulf.",
  applicationName: "Sidelick",
  manifest: "/manifest.json",
  keywords: [
    "dog walking",
    "dog sitting",
    "dog boarding",
    "pet care",
    "dog daycare",
    "dog walker Beirut",
    "pet sitting Lebanon",
    "verified dog walkers",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Sidelick",
    locale: "en_US",
    url: siteUrl,
    title: "Sidelick — Trusted dog walking & sitting",
    description:
      "Walks, daycare, and travel sitting from one verified person. Serving Beirut and the Gulf.",
    images: [
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Sidelick",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sidelick — Trusted dog walking & sitting",
    description: "Walks, daycare, and travel sitting from one verified person.",
    images: ["/icons/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body>
        <Providers>
          <AppNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
