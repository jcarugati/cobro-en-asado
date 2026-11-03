import "server-only";
import { unstable_cache } from "next/cache";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { IndecError } from "./indec.ts";
import { getSnapshot } from "./snapshot.ts";

// shortcut: unstable_cache serves stale data on refresh failure, so page regeneration succeeds and retries about a day later; revisit if faster recovery matters.
export const loadSnapshot = unstable_cache(
  async () => {
    try {
      return await Effect.runPromise(getSnapshot.pipe(Effect.provide(FetchHttpClient.layer)));
    } catch (error) {
      throw new Error(error instanceof IndecError ? error.message : "Unexpected snapshot 0");
    }
  },
  ["snapshot", process.env.VERCEL_GIT_COMMIT_SHA ?? "local"],
  { revalidate: 86_400 },
);
