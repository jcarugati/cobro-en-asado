import type { Metadata } from "next";
import { Game } from "../../src/components/Game.tsx";
import { dailySeed } from "../../src/domain/game.ts";
import { loadSnapshot } from "../../src/server/loadSnapshot.ts";

export const metadata: Metadata = { title: "¿Más o menos? · Cobro en Asado" };
export const revalidate = 86_400;

export default async function Page() {
  const snapshot = await loadSnapshot();
  return <Game snapshot={snapshot} seed={dailySeed(Date.now())} month={snapshot.lastMonth} />;
}
