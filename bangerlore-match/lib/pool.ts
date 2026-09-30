// Shared resumable worker pool (eng review Issues 3/4/5, 2026-06-05).
// Replaces three hand-rolled copies in index.ts / blurbs.ts / match.ts.
//
//   queue ──► N workers ──► run(item) ──► checkpoint()   (serialized+atomic)
//                              │
//                              └─ failure ──► collected ──► summary
//                                                            │
//                                     exitCode=1 unless ALLOW_PARTIAL=1
//
// Failure policy (review D14): any failed item makes the process exit
// non-zero so `bun run pipeline`'s && chain stops before building HTML on
// partial data. Setting ALLOW_PARTIAL=1 downgrades that to a loud warning —
// the documented 6pm escape hatch, never the default.

import { rename } from "node:fs/promises";

export type PoolFailure = { name: string; error: string };

// Atomic JSON write: write to a sibling temp file, then rename. The target is
// always either the previous complete file or the new complete file — a crash
// mid-write can never leave torn JSON behind (Issue 5).
let writeChain: Promise<unknown> = Promise.resolve();

export function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  // Serialize all writes through one chain: no interleaved writers (Issue 5).
  const next = writeChain.then(async () => {
    const tmp = `${path}.tmp`;
    await Bun.write(tmp, JSON.stringify(value, null, 2));
    await rename(tmp, path);
  });
  // Keep the chain alive even if a write fails; callers still see the error.
  writeChain = next.catch(() => {});
  return next;
}

export async function runPool<T>(options: {
  items: T[];
  concurrency: number;
  name: (item: T) => string;
  run: (item: T) => Promise<void>;
  checkpoint: () => Promise<void>;
}): Promise<{ failures: PoolFailure[] }> {
  const { items, concurrency, name, run, checkpoint } = options;
  const queue = [...items];
  const total = queue.length;
  const failures: PoolFailure[] = [];
  let completed = 0;

  async function worker() {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) return;

      try {
        await run(item);
        await checkpoint();
      } catch (error) {
        failures.push({
          name: name(item),
          error: error instanceof Error ? error.message : String(error),
        });
      }
      completed += 1;
      console.log(`[${completed}/${total}] ${name(item)}`);
    }
  }

  await Promise.all(
    Array.from({ length: Math.max(1, concurrency) }, () => worker()),
  );
  await checkpoint();

  if (failures.length) {
    console.error(`\nFAILED: ${failures.length}/${total} items`);
    for (const failure of failures) {
      console.error(`  - ${failure.name}: ${failure.error}`);
    }
    if (Bun.env.ALLOW_PARTIAL === "1") {
      console.error(
        "ALLOW_PARTIAL=1 set — continuing with partial data. Omissions listed above.",
      );
    } else {
      console.error(
        "Exiting non-zero so downstream steps do not build on partial data. " +
          "Rerun to retry (completed items resume), or set ALLOW_PARTIAL=1 to override.",
      );
      process.exitCode = 1;
    }
  }

  return { failures };
}
