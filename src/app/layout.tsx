import type { Metadata } from "next";
import { EB_Garamond, JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const display = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "The Met Archive",
  description:
    "Search an everyday subject to follow it through time and discover what surrounds it in The Met Open Access collection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} ${mono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
