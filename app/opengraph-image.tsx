import { renderCard } from "../src/server/card.tsx";

export const alt = "Tu sueldo, en la unidad que entendemos todos: kilos de asado.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return renderCard({ headline: alt, detail: null, footer: "Promedio GBA · INDEC" });
}
