import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cobro-en-asado.vercel.app"),
  twitter: { card: "summary_large_image" },
  title: "Cobro en Asado",
  description: "Tu sueldo, en la unidad que entendemos todos: kilos de asado.",
};

const archivo = localFont({
  src: [
    { path: "./fonts/archivo-latin-400-normal.woff", weight: "400", style: "normal" },
    { path: "./fonts/archivo-latin-800-normal.woff", weight: "800", style: "normal" },
  ],
});

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es-AR" className={archivo.className}><body>{children}</body></html>;
}
