import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { StorageAdapter } from "../../StorageAdapter.js";
import { MockStorage } from "../helpers/MockStorage.js";

describe("StorageAdapter fuzz", () => {
  it("write-read identity for any string", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 0, maxLength: 10_000 }), async (data) => {
        const storage = new MockStorage();
        const adapter = new StorageAdapter(storage);
        await adapter.write(data);
        expect(await adapter.read()).toBe(data);
      }),
    );
  });

  it("purge always clears after any write", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 0, maxLength: 1000 }), async (data) => {
        const storage = new MockStorage();
        const adapter = new StorageAdapter(storage);
        await adapter.write(data);
        await adapter.purge();
        expect(await adapter.read()).toBeNull();
      }),
    );
  });

  it("getSize equals string length for any written data", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 0, maxLength: 10_000 }), async (data) => {
        const storage = new MockStorage();
        const adapter = new StorageAdapter(storage);
        await adapter.write(data);
        expect(await adapter.getSize()).toBe(data.length);
      }),
    );
  });

  it("key isolation: data at key1 is not readable from key2", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }).filter((k) => k !== "key1"),
        fc.string({ minLength: 1, maxLength: 100 }),
        async (key1, key2, data) => {
          // Skip if keys happen to collide
          if (key1 === key2) return;
          const storage = new MockStorage();
          const adapter1 = new StorageAdapter(storage, key1);
          const adapter2 = new StorageAdapter(storage, key2);
          await adapter1.write(data);
          expect(await adapter2.read()).toBeNull();
        },
      ),
    );
  });
});
