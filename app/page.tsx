import { loadSnapshot } from "../src/server/loadSnapshot.ts";

export const revalidate = 86_400;

export default async function Page() {
  const snapshot = await loadSnapshot();
  const price = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(snapshot.prices.asado.at(-1)!);
  const month = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${snapshot.lastMonth.slice(0, 4)}-${snapshot.lastMonth.slice(4)}-01T00:00:00Z`))
    .replace(" de ", " ");
  return <main><h1>Asado: {price} por kilo</h1><p>Promedio GBA · {month} · Fuente: INDEC</p></main>;
}
