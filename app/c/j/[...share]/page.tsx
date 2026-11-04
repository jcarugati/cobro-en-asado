import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as Option from "effect/Option";
import { decodeGameSegments, gameRounds, gameSharedLine, gameCardPath } from "../../../../src/domain/game.ts";
import { loadSnapshot } from "../../../../src/server/loadSnapshot.ts";

export const revalidate = 86_400;
export async function generateStaticParams() { return []; }
type Props = { params: Promise<{ share: string[] }> };

async function sharedResult({ params }: Props) {
  const input = decodeGameSegments((await params).share);
  if (Option.isNone(input)) notFound();
  const snapshot = await loadSnapshot();
  if (Option.isNone(gameRounds(snapshot, input.value))) notFound();
  return input.value;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const result = await sharedResult(props);
  const title = gameSharedLine(result);
  const description = "¿Subió más o menos que la inflación?";
  const image = { url: gameCardPath(result), width: 1200, height: 630 };
  return { title, description,
    openGraph: { title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
    robots: { index: false, follow: true },
  };
}

export default async function SharedPage(props: Props) {
  const result = await sharedResult(props);
  return <main><p>{gameSharedLine(result)}</p></main>;
}
