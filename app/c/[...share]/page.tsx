import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as Option from "effect/Option";
import { Calculator } from "../../../src/components/Calculator.tsx";
import { cardPath, decodeShareSegments, sharedLine } from "../../../src/domain/share.ts";
import { loadSnapshot } from "../../../src/server/loadSnapshot.ts";

export const revalidate = 86_400;
export async function generateStaticParams() { return []; }

type Props = { params: Promise<{ share: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const result = decodeShareSegments((await params).share);
  if (Option.isNone(result)) notFound();
  const title = sharedLine(result.value);
  const description = "Tu sueldo, en la unidad que entendemos todos: kilos de asado.";
  const image = { url: Option.getOrThrow(cardPath(result.value)), width: 1200, height: 630 };
  return {
    title, description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: { index: false, follow: true },
  };
}

export default async function SharedPage({ params }: Props) {
  const result = decodeShareSegments((await params).share);
  if (Option.isNone(result)) notFound();
  const snapshot = await loadSnapshot();
  return <Calculator snapshot={snapshot} shared={result.value} />;
}
