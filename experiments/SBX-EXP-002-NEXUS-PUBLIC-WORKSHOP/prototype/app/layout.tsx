import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://nexus-public-workshop.everythingbitesized.chatgpt.site",
  ),
  title: {
    default: "NEXUS Public Workshop",
    template: "%s // NEXUS Public Workshop",
  },
  description:
    "A public, read-only documentary prototype for NEXUS writing, evidence, and open experiments.",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
