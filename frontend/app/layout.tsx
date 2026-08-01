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
    "Book verified pet care — walks, daycare, boarding, and drop-in visits from one trusted person. Serving Lebanon and the Gulf.",
  applicationName: "Sidelick",
  manifest: "/manifest.json",
  keywords: [
    "dog walking",
    "dog sitting",
    "dog boarding",
    "pet care",
    "dog daycare",
    "dog walker Beirut",
    "dog walker Lebanon",
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
      "Walks, daycare, boarding, and drop-in visits from one verified person. Serving Lebanon and the Gulf.",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "Sidelick — Loved by your dog. Trusted by you.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sidelick — Trusted dog walking & sitting",
    description: "Walks, daycare, boarding, and drop-in visits from one verified person.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  themeColor: "#fbf6f1",
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
