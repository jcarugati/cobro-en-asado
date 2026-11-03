import { ICONS } from "../domain/icons.ts";
import type { UnitSlug } from "../domain/units.ts";

// The cream sticker edge keeps every icon readable on any ground, the dark card included.
const STICKER_EDGE = { stroke: "#fff5e4", strokeWidth: 2.6, strokeLinejoin: "round", paintOrder: "stroke" } as const;

// A plain function, not a component: satori only takes intrinsic elements inside an svg.
export function iconPaths(unit: UnitSlug) {
  return ICONS[unit].map(([fill, d], index) => <path key={index} fill={fill} d={d} {...(index === 0 ? STICKER_EDGE : {})} />);
}

export function UnitIcon({ unit, size }: { unit: UnitSlug; size?: number }) {
  return (
    <svg viewBox="-2 -2 36 36" width={size} height={size} aria-hidden="true">
      {iconPaths(unit)}
    </svg>
  );
}
