import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { cardLines } from "../domain/share.ts";

const regular = readFileSync(join(process.cwd(), "app/fonts/archivo-latin-400-normal.woff"));
const bold = readFileSync(join(process.cwd(), "app/fonts/archivo-latin-800-normal.woff"));

export function renderCard(lines: ReturnType<typeof cardLines>, init?: ResponseInit): ImageResponse {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 64, background: "#f3e7d8", color: "#1c1815", fontFamily: "Archivo" }}>
      <div style={{ width: 64, height: 8, background: "#c2410c", marginBottom: 32 }} />
      <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.08 }}>{lines.headline}</div>
      {lines.detail && <div style={{ display: "flex", fontSize: 36, marginTop: 24 }}>{lines.detail}</div>}
      <div style={{ display: "flex", fontSize: 28, marginTop: "auto" }}>{lines.footer}</div>
    </div>,
    {
      ...init,
      width: 1200,
      height: 630,
      fonts: [
        { name: "Archivo", data: regular, weight: 400, style: "normal" },
        { name: "Archivo", data: bold, weight: 800, style: "normal" },
      ],
    },
  );
}
