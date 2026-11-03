import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import { TALLY_STRIKE, TALLY_STROKES, tally } from "../domain/calc.ts";
import { formatCount } from "../domain/format.ts";
import type { CardLines } from "../domain/share.ts";

const regular = readFileSync(join(process.cwd(), "app/fonts/archivo-latin-400-normal.woff"));
const bold = readFileSync(join(process.cwd(), "app/fonts/archivo-latin-800-normal.woff"));

// The page's light tokens (app/globals.css). A PNG has no dark mode.
const PAPER = "#f3e7d7";
const INK = "#1c1713";
const MUTED = "#5e5147";
const EMBER = "#be3207";

const WIDTH = 1200;
const HEIGHT = 630;
const INNER = WIDTH - 2 * 56;

// SVG because satori throws on dotted borders: it only takes solid and dashed.
function DottedRule() {
  return (
    <svg width={INNER} height={4} viewBox={`0 0 ${INNER} 4`} style={{ flexShrink: 0 }}>
      <line x1={2} y1={2} x2={INNER - 2} y2={2} stroke={MUTED} strokeWidth={4} strokeLinecap="round" strokeDasharray="0 10" />
    </svg>
  );
}

function Tally({ count }: { count: number }) {
  const { groups, overflow } = tally(count);
  if (count === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, height: 40, color: EMBER, fontSize: 28, fontWeight: 800 }}>
      {groups.map((marks, index) => (
        <svg key={index} width={38} height={36} viewBox="-3 0 34 30" style={{ transform: `rotate(${[2, 0, -3][index % 3]}deg)` }}>
          <path
            d={marks === 5 ? `${TALLY_STROKES.join(" ")} ${TALLY_STRIKE}` : TALLY_STROKES.slice(0, marks).join(" ")}
            fill="none"
            stroke={EMBER}
            strokeWidth={2.8}
            strokeLinecap="round"
          />
        </svg>
      ))}
      {overflow > 0 && <span style={{ marginLeft: 6 }}>+{formatCount(overflow)}</span>}
    </div>
  );
}

function ticket(footer: string, children: ReactNode, init?: ResponseInit): ImageResponse {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "36px 56px", background: PAPER, color: INK, fontFamily: "Archivo" }}>
      <div style={{ display: "flex", fontSize: 38, fontWeight: 800, paddingBottom: 14 }}>Cobro en Asado</div>
      <DottedRule />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, minHeight: 0 }}>{children}</div>
      <DottedRule />
      <div style={{ display: "flex", fontSize: 30, color: MUTED, paddingTop: 14 }}>{footer}</div>
    </div>,
    {
      ...init,
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Archivo", data: regular, weight: 400, style: "normal" },
        { name: "Archivo", data: bold, weight: 800, style: "normal" },
      ],
    },
  );
}

export function renderCard(lines: CardLines, init?: ResponseInit): ImageResponse {
  const number = formatCount(lines.count);
  // An override's tail breaks after its comma into two lines, so its number gives up height. 0.67 is the page's width per character.
  const twoLines = lines.tail.includes(", ");
  // A then-vs-now card caps its number lower: at 216 the lead gets tight under the top rule, and a smaller number reads less like the result.
  const size = Math.min(twoLines ? 170 : lines.kind === "t" ? 190 : 216, Math.floor(INNER / (number.length * 0.67)));
  return ticket(
    lines.footer,
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 46, fontWeight: 800, lineHeight: 1.1 }}>{lines.lead}</div>
      <div style={{ display: "flex", fontSize: size, fontWeight: 800, lineHeight: 0.9, letterSpacing: "-0.02em", marginLeft: -size * 0.035 }}>{number}</div>
      <div style={{ display: "flex", fontSize: 46, fontWeight: 800, lineHeight: 1.1, whiteSpace: "pre-line" }}>{lines.tail.replace(", ", ",\n")}</div>
      <Tally count={lines.count} />
      {/* On a then-vs-now card, today's number is the point. */}
      {lines.detail && <div style={{ display: "flex", fontWeight: 800, marginTop: 8, lineHeight: 1.1, ...(lines.kind === "t" ? { fontSize: 64, color: EMBER } : { fontSize: 38 }) }}>{lines.detail}</div>}
    </div>,
    init,
  );
}

export function renderPreview(text: string, footer: string): ImageResponse {
  return ticket(
    footer,
    <div style={{ display: "flex", fontSize: 92, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.015em", textWrap: "balance" }}>{text}</div>,
  );
}
