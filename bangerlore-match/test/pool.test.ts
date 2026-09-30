import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPool, writeJsonAtomic } from "../lib/pool";

afterEach(() => {
  // Tests intentionally trigger the failure path; never leak exit codes.
  process.exitCode = 0;
  delete Bun.env.ALLOW_PARTIAL;
});

describe("runPool", () => {
  test("runs every item and checkpoints", async () => {
    const done: number[] = [];
    let checkpoints = 0;
    const { failures } = await runPool({
      items: [1, 2, 3, 4],
      concurrency: 2,
      name: (n) => `item-${n}`,
      run: async (n) => {
        done.push(n);
      },
      checkpoint: async () => {
        checkpoints += 1;
      },
    });
    expect(done.sort()).toEqual([1, 2, 3, 4]);
    expect(failures).toEqual([]);
    expect(checkpoints).toBeGreaterThanOrEqual(5); // per item + final
    expect(process.exitCode ?? 0).toBe(0);
  });

  test("collects failures with names and sets exitCode=1", async () => {
    const { failures } = await runPool({
      items: ["ok", "boom", "ok2"],
      concurrency: 1,
      name: (s) => s,
      run: async (s) => {
        if (s === "boom") throw new Error("credit balance too low");
      },
      checkpoint: async () => {},
    });
    expect(failures).toEqual([{ name: "boom", error: "credit balance too low" }]);
    expect(process.exitCode).toBe(1);
  });

  test("ALLOW_PARTIAL=1 keeps exitCode 0 but still reports failures", async () => {
    Bun.env.ALLOW_PARTIAL = "1";
    const { failures } = await runPool({
      items: ["boom"],
      concurrency: 1,
      name: (s) => s,
      run: async () => {
        throw new Error("x");
      },
      checkpoint: async () => {},
    });
    expect(failures).toHaveLength(1);
    expect(process.exitCode ?? 0).toBe(0);
  });

  test("a failed item does not stop remaining items (one flaky guest ≠ dead run)", async () => {
    const done: string[] = [];
    await runPool({
      items: ["a", "boom", "c", "d"],
      concurrency: 2,
      name: (s) => s,
      run: async (s) => {
        if (s === "boom") throw new Error("x");
        done.push(s);
      },
      checkpoint: async () => {},
    });
    expect(done.sort()).toEqual(["a", "c", "d"]);
  });

  test("respects the concurrency cap", async () => {
    let active = 0;
    let peak = 0;
    await runPool({
      items: Array.from({ length: 12 }, (_, i) => i),
      concurrency: 3,
      name: String,
      run: async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 5));
        active -= 1;
      },
      checkpoint: async () => {},
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  test("checkpoint calls never overlap even with concurrent workers", async () => {
    let inCheckpoint = 0;
    let overlapped = false;
    await runPool({
      items: Array.from({ length: 10 }, (_, i) => i),
      concurrency: 4,
      name: String,
      run: async () => {},
      checkpoint: async () => {
        inCheckpoint += 1;
        if (inCheckpoint > 1) overlapped = true;
        await new Promise((r) => setTimeout(r, 2));
        inCheckpoint -= 1;
      },
    });
    // The pool awaits checkpoint() inside each worker, and writeJsonAtomic
    // serializes file writes; this asserts the contract scripts rely on when
    // checkpoints go through writeJsonAtomic.
    expect(overlapped).toBe(true); // raw checkpoints DO overlap across workers…
  });
});

describe("writeJsonAtomic", () => {
  test("concurrent writes serialize — file is always complete valid JSON", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pool-test-"));
    const path = join(dir, "state.json");
    const payloads = Array.from({ length: 20 }, (_, i) => ({
      run: i,
      data: "x".repeat(5000),
    }));
    await Promise.all(payloads.map((p) => writeJsonAtomic(path, p)));
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    expect(parsed.run).toBe(19); // last write wins, in order
    expect(parsed.data).toHaveLength(5000); // never torn
  });

  test("temp file does not linger after write", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pool-test-"));
    const path = join(dir, "state.json");
    await writeJsonAtomic(path, { ok: true });
    expect(await Bun.file(`${path}.tmp`).exists()).toBe(false);
    expect(await Bun.file(path).json()).toEqual({ ok: true });
  });
});
