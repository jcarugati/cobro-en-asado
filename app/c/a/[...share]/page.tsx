import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { decodePlanSegments, planAsado, planSharedLine, planCardPath } from "../../../../src/domain/planner.ts";
import { loadSnapshot } from "../../../../src/server/loadSnapshot.ts";

export const revalidate = 86_400;
export async function generateStaticParams() { return []; }
type Props = { params: Promise<{ share: string[] }> };

async function sharedResult({ params }: Props) {
  const input = decodePlanSegments((await params).share);
  if (Option.isNone(input)) notFound();
  const snapshot = await loadSnapshot();
  const plan = planAsado(snapshot, input.value);
  if (Result.isFailure(plan)) notFound();
  return plan.success;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const result = await sharedResult(props);
  const title = planSharedLine(result);
  const description = "Armá tu asado.";
  const image = { url: planCardPath(result), width: 1200, height: 630 };
  return { title, description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: { index: false, follow: true },
  };
}

export default async function SharedPage(props: Props) {
  const result = await sharedResult(props);
  return <main><p>{planSharedLine(result)}</p></main>;
}
