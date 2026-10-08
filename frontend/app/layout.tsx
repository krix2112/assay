import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assay",
  description: "Daily intelligence tool comparing MCX gold futures contracts",
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
