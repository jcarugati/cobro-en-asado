import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cobro-en-asado.vercel.app"),
  twitter: { card: "summary_large_image" },
  title: "Cobro en Asado",
  description: "Tu sueldo, en la unidad que entendemos todos: kilos de asado.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffd9c4" },
    { media: "(prefers-color-scheme: dark)", color: "#1d0a07" },
  ],
};

// woff2 here for the smaller download. The share card keeps the .woff files: satori can't read woff2.
const display = localFont({
  src: "./fonts/caprasimo-latin-400-normal.woff2",
  variable: "--font-display",
});

const body = localFont({
  src: [
    { path: "./fonts/figtree-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/figtree-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-body",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es-AR" className={`${display.variable} ${body.variable}`}><body>{children}</body></html>;
}
