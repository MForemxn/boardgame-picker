import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "🎲 Board Game Picker",
  description: "Randomly pick a board game from Adam's collection",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
