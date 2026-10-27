import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { Analytics } from "@vercel/analytics/next";
import "@fontsource/barlow/400.css";
import "@fontsource/barlow/600.css";
import "@fontsource/barlow-condensed/600-italic.css";
import "@fontsource/barlow-condensed/700-italic.css";
import "@fontsource/barlow-condensed/800-italic.css";
import "@fontsource/barlow-condensed/700.css";
import "./globals.css";
import "./card-fx.css";

export const metadata: Metadata = {
  title: "GymDeck",
  description: "Ta séance, ton booster.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon-192.png?v=2", apple: "/apple-touch-icon.png?v=2" },
  appleWebApp: { capable: true, title: "GymDeck", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#070a12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  preload("/assets/ui/booster.webp", { as: "image" });
  preload("/assets/ui/dos-carte.webp", { as: "image" });
  return (
    <html lang="fr">
      <body>
        {children}
        {/* statistiques de visite Vercel (sans cookie) */}
        <Analytics />
      </body>
    </html>
  );
}
