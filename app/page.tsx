import { Calculator } from "../src/components/Calculator.tsx";
import { loadSnapshot } from "../src/server/loadSnapshot.ts";

export const revalidate = 86_400;

export default async function Page() {
  const snapshot = await loadSnapshot();
  return <Calculator snapshot={snapshot} />;
}
