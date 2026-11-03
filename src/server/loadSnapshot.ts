import "server-only";
import { unstable_cache } from "next/cache";
import { Effect, Result } from "effect";
import { FetchHttpClient } from "effect/http";
import { getSnapshot } from "./snapshot.ts";

// shortcut: stacked page/data caches may delay releases about 48 hours, revisit if monthly data needs faster freshness.
export const loadSnapshot = unstable_cache(
  async () => {
    try {
      const result = await Effect.runPromise(Effect.result(
        getSnapshot.pipe(Effect.provide(FetchHttpClient.layer)),
      ));
      if (Result.isFailure(result)) throw new Error(result.failure.message);
      return result.success;
    } catch (error) {
      // Only allow our safe vocabulary across the Next logging boundary.
      const message = error instanceof Error && /^(Transport|Status|Timeout|Decode|Pagination|Validation|Config) (ipc_nacional|valorizacion_canastas_cba_cbt|canasta-crianza|snapshot) \d+$/.test(error.message)
        ? error.message : "Unexpected snapshot 0";
      throw new Error(message);
    }
  },
  ["snapshot", process.env.VERCEL_GIT_COMMIT_SHA ?? "local"],
  { revalidate: 86_400 },
);
