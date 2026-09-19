import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Service Worker Credit Union",
    template: "%s | SWCU",
  },
  description:
    "The public website of Service Worker Credit Union in Suva, Fiji.",
  icons: {
    icon: [
      { url: "/brand/swcu/favicon.ico" },
      { url: "/brand/swcu/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/swcu/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/brand/swcu/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable}`}>{children}</body>
    </html>
  );
}