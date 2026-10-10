import localFont from "next/font/local";

export const funnelDisplay = localFont({
  src: "../public/fonts/FunnelDisplay-Variable.ttf",
  variable: "--font-display",
  display: "swap",
  weight: "300 800",
});

export const instrumentSans = localFont({
  src: "../public/fonts/InstrumentSans-Variable.ttf",
  variable: "--font-body",
  display: "swap",
  weight: "400 700",
});
