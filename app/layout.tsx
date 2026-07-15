import type { Metadata } from "next";
import { Inter, Space_Mono } from "next/font/google";
import "./globals.css";

// Inter is the closest free equivalent to the licensed Helvetica Now Pro
// Text this design references (klaysheets: heliotemil.com/blogs/universe) -
// a neutral, refined neo-grotesque built for UI/text clarity rather than a
// characterful display face. Space Mono stays for the technical/data
// readouts (counts, categories, density) - that instrument-panel layer
// doesn't have an analog on the reference site, so it's kept distinct
// rather than flattened to match.
const inter = Inter({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const spaceMono = Space_Mono({
  variable: "--font-technical",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "KLAY cultural landscape",
  description: "Browsing connections across the KLAY cultural landscape",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-white">{children}</body>
    </html>
  );
}
