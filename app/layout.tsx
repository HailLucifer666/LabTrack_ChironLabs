import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabTrack · Dental case operations",
  description: "A lightweight dashboard for tracking dental laboratory cases and clinic notifications.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
