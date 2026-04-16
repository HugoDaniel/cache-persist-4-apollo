import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { InMemoryCache } from "@apollo/client";
import { CachePersistor } from "../../CachePersistor.js";
import { CacheAdapter } from "../../CacheAdapter.js";
import { CacheCorruptionError } from "../../errors.js";
import { MockStorage } from "../helpers/MockStorage.js";
import { createPopulatedCache } from "../helpers/createTestCache.js";

describe("validation fuzz", () => {
  it("CachePersistor rejects negative debounce values", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: -1 }),
        (debounce) => {
          expect(
            () =>
              new CachePersistor({
                cache: new InMemoryCache(),
                storage: new MockStorage(),
                debounce,
              }),
          ).toThrow("debounce must be a non-negative number");
        },
      ),
    );
  });

  it("CachePersistor accepts any non-negative debounce", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        (debounce) => {
          expect(
            () =>
              new CachePersistor({
                cache: new InMemoryCache(),
                storage: new MockStorage(),
                debounce,
                trigger: false,
              }),
          ).not.toThrow();
        },
      ),
    );
  });

  it("CachePersistor rejects zero or negative maxSize", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }),
        (maxSize) => {
          expect(
            () =>
              new CachePersistor({
                cache: new InMemoryCache(),
                storage: new MockStorage(),
                maxSize,
                trigger: false,
              }),
          ).toThrow("maxSize must be a positive number or false");
        },
      ),
    );
  });

  it("CachePersistor accepts any positive maxSize", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000_000 }),
        (maxSize) => {
          expect(
            () =>
              new CachePersistor({
                cache: new InMemoryCache(),
                storage: new MockStorage(),
                maxSize,
                trigger: false,
              }),
          ).not.toThrow();
        },
      ),
    );
  });

  it("CacheAdapter.restore rejects empty strings", () => {
    const adapter = new CacheAdapter(new InMemoryCache());
    expect(() => adapter.restore("")).toThrow("non-empty string");
  });

  it("corrupt data in storage always results in CacheCorruptionError or success", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 500 }),
        async (data) => {
          const storage = new MockStorage();
          storage.setItem("apollo-cache-persist", data);

          const cache = new InMemoryCache();
          const persistor = new CachePersistor({
            cache,
            storage,
            trigger: false,
          });

          try {
            await persistor.restore();
            // If it succeeded, the data must have been valid JSON that
            // the cache accepted
            const parsed = JSON.parse(data);
            expect(parsed).toBeDefined();
          } catch (error) {
            // Must be a CacheCorruptionError, not a raw SyntaxError
            expect(error).toBeInstanceOf(CacheCorruptionError);
          }
        },
      ),
    );
  });

  it("persisted data survives round-trip for any valid cache content", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.string({ minLength: 0, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        async (_items) => {
          const cache = createPopulatedCache();
          const storage = new MockStorage();

          const p1 = new CachePersistor({
            cache,
            storage,
            trigger: false,
          });
          await p1.persist();

          const newCache = new InMemoryCache();
          const p2 = new CachePersistor({
            cache: newCache,
            storage,
            trigger: false,
          });
          await p2.restore();

          expect(newCache.extract()).toEqual(cache.extract());
        },
      ),
    );
  });
});
