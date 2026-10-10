import type { Metadata } from "next";
import { funnelDisplay, instrumentSans } from "./fonts";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/app-shell";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Assay — MCX Gold Futures Parity Intelligence",
  description: "Daily intelligence tool comparing MCX gold futures contracts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${funnelDisplay.variable} ${instrumentSans.variable}`}>
      {/* Zero-flash theme init — runs before any paint */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-body antialiased" style={{ background: "var(--color-page)", color: "var(--color-text)" }}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
