import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import "./globals.css";

const sans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

const editorial = Newsreader({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "LabTrack · Dental case operations",
  description: "A lightweight dashboard for tracking dental laboratory cases and clinic notifications.",
};

export const viewport: Viewport = {
  themeColor: "#f4f7f1",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${editorial.variable}`}>{children}</body>
    </html>
  );
}
