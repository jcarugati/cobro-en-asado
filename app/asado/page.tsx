import type { Metadata } from "next";
import { AsadoPlanner } from "../../src/components/AsadoPlanner.tsx";
import { loadSnapshot } from "../../src/server/loadSnapshot.ts";

export const metadata: Metadata = { title: "Armá tu asado · Cobro en Asado" };
export const revalidate = 86_400;

export default async function Page() {
  const snapshot = await loadSnapshot();
  return <AsadoPlanner snapshot={snapshot} />;
}
