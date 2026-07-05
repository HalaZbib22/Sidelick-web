import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppNav } from "../components/nav/AppNav";

export const metadata: Metadata = {
  title: "Sidelick — Trusted dog walking & sitting",
  description:
    "Book verified dog walkers and sitters — walks, daycare, and travel sitting from one trusted person.",
  manifest: "/manifest.json",
  openGraph: {
    title: "Sidelick — Trusted dog walking & sitting",
    description: "Walks, daycare, and travel sitting from one verified person.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <AppNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
