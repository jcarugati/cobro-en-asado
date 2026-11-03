import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { ImageResponse } from "next/og";
import { iconPaths, UnitIcon } from "../components/UnitIcon.tsx";
import { iconGrid } from "../domain/calc.ts";
import { countPhrase, formatCount } from "../domain/format.ts";
import type { CardLines } from "../domain/share.ts";
import { UNITS, type UnitSlug } from "../domain/units.ts";

const display = readFileSync(join(process.cwd(), "app/fonts/caprasimo-latin-400-normal.woff"));
const regular = readFileSync(join(process.cwd(), "app/fonts/figtree-latin-500-normal.woff"));

// The page's light tokens (app/globals.css). A PNG has no dark mode.
const GROUND = "#ffd9c4";
const CARD = "#5c120c";
const ON_CARD = "#fff5e4";
const ON_CARD_SOFT = "#f7d3c4";
const YOLK = "#ffb627";

const WIDTH = 1200;
const HEIGHT = 630;
const TRAY_WIDTH = 440;
const TRAY_HEIGHT = 380;
const TEXT_WIDTH = WIDTH - 2 * (24 + 48) - TRAY_WIDTH - 36;

function frame(top: ReactNode, footer: string, left: ReactNode, right: ReactNode, init?: ResponseInit): ImageResponse {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", padding: 24, background: GROUND, fontFamily: "Caprasimo" }}>
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "34px 48px 30px", borderRadius: 44, background: CARD, color: ON_CARD }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 44, lineHeight: 1 }}>
          <div style={{ display: "flex" }}>{top}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 30 }}><UnitIcon unit="asado" size={46} />Cobro en Asado</div>
        </div>
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexGrow: 1, minHeight: 0 }}>{left}{right}</div>
        <div style={{ display: "flex", fontFamily: "Figtree", fontSize: 26, color: ON_CARD_SOFT }}>{footer}</div>
      </div>
    </div>,
    {
      ...init,
      width: WIDTH,
      height: HEIGHT,
      fonts: [
        { name: "Caprasimo", data: display, weight: 400, style: "normal" },
        { name: "Figtree", data: regular, weight: 500, style: "normal" },
      ],
    },
  );
}

// One SVG instead of one per icon: satori turns each into an image of its own.
function Tray({ unit, count }: { unit: UnitSlug; count: number }) {
  const { icons, each } = iconGrid(count);
  if (icons === 0) return null;
  // Squarer than the page's pile: a chat shows this card small, so each icon gets all the size it can.
  const columns = Math.ceil(Math.sqrt(icons));
  const rows = Math.ceil(icons / columns);
  // Each icon is a little bigger than its cell, like the page's pile, and the last row and column still have to fit.
  const cell = Math.min(TRAY_WIDTH / (columns + 0.14), TRAY_HEIGHT / (rows + 0.14));
  const width = (columns + 0.14) * cell;
  const height = (rows + 0.14) * cell;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", width: TRAY_WIDTH, flexShrink: 0 }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {Array.from({ length: icons }, (_, index) => (
          <g key={index} transform={`translate(${(index % columns) * cell} ${Math.floor(index / columns) * cell}) scale(${cell * 1.14 / 36}) rotate(${[4, 0, -5, 2, -2][index % 5]} 18 18) translate(2 2)`}>
            {iconPaths(unit)}
          </g>
        ))}
      </svg>
      {each > 1 && <div style={{ display: "flex", marginTop: 6, fontFamily: "Figtree", fontSize: 22, color: ON_CARD_SOFT }}>{`Cada ícono: ${countPhrase(unit, each)}.`}</div>}
    </div>
  );
}

export function renderCard(unit: UnitSlug, lines: CardLines, init?: ResponseInit): ImageResponse {
  const number = formatCount(lines.count);
  // An override's tail breaks after its comma into two lines, so its number gives up height. 0.68 is the display face's width per digit.
  const twoLines = lines.tail.includes(", ");
  const size = Math.min(twoLines ? 180 : 240, Math.floor(TEXT_WIDTH / (number.length * 0.68)));
  return frame(
    lines.lead,
    lines.footer,
    <div style={{ display: "flex", flexDirection: "column", width: TEXT_WIDTH }}>
      <div style={{ display: "flex", fontSize: size, lineHeight: 0.95, letterSpacing: "-0.02em", marginLeft: -size * 0.03 }}>{number}</div>
      {/* One box per clause: balancing can't reach across a forced line break. */}
      {lines.tail.replace(", ", ",\n").split("\n").map((clause) => (
        <div key={clause} style={{ display: "flex", fontSize: twoLines ? 40 : 46, lineHeight: 1.08, color: YOLK, textWrap: "balance" }}>{clause}</div>
      ))}
      {/* On a then-vs-now card, today's number is the point. */}
      {lines.detail && <div style={{ display: "flex", marginTop: 12, lineHeight: 1.1, ...(lines.kind === "t" ? { fontSize: 62 } : { fontSize: 32 }) }}>{lines.detail}</div>}
    </div>,
    <Tray unit={unit} count={lines.count} />,
    init,
  );
}

export function renderPreview(text: string, footer: string): ImageResponse {
  return frame(
    "",
    footer,
    <div style={{ display: "flex", width: TEXT_WIDTH, fontSize: 70, lineHeight: 1.06, letterSpacing: "-0.01em" }}>{text}</div>,
    <div style={{ display: "flex", flexWrap: "wrap", width: TRAY_WIDTH, gap: 4 }}>
      {/* A full grid of 5 by 4: the last two units would hang on a short row. */}
      {UNITS.slice(0, 20).map((item) => <UnitIcon key={item.slug} unit={item.slug} size={84} />)}
    </div>,
  );
}
