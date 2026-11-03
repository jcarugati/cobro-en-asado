import { writeFile } from "node:fs/promises";
import { NodeRuntime } from "@effect/platform-node";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { getSnapshot } from "../src/server/snapshot.ts";

NodeRuntime.runMain(Effect.gen(function*() {
  const snapshot = yield* getSnapshot;
  if (snapshot.lastMonth !== "202609") {
    return yield* Effect.fail(new Error("Fixture requires lastMonth 202609"));
  }
  yield* Effect.tryPromise(() => writeFile(
    new URL("../test/fixtures/snapshot-202609.json", import.meta.url),
    JSON.stringify(snapshot) + "\n",
  ));
}).pipe(Effect.provide(FetchHttpClient.layer)));
