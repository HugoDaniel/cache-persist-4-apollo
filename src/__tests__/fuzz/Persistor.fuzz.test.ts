import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { InMemoryCache, gql } from "@apollo/client";
import { CacheAdapter } from "../../CacheAdapter.js";
import { StorageAdapter } from "../../StorageAdapter.js";
import { Persistor } from "../../Persistor.js";
import { MockStorage } from "../helpers/MockStorage.js";

const WRITE_QUERY = gql`
  query {
    item {
      id
      value
    }
  }
`;

describe("Persistor fuzz", () => {
  it("persist-restore round-trip for any cache data", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        async (id, value) => {
          const cache = new InMemoryCache();
          cache.writeQuery({
            query: WRITE_QUERY,
            data: { item: { __typename: "Item", id, value } },
          });
          const storage = new MockStorage();
          const cacheAdapter = new CacheAdapter(cache);
          const storageAdapter = new StorageAdapter(storage);
          const persistor = new Persistor(cacheAdapter, storageAdapter, {});

          await persistor.persist();

          const targetCache = new InMemoryCache();
          const targetCacheAdapter = new CacheAdapter(targetCache);
          const targetPersistor = new Persistor(
            targetCacheAdapter,
            storageAdapter,
            {},
          );
          await targetPersistor.restore();

          expect(targetCache.extract()).toEqual(cache.extract());
        },
      ),
    );
  });

  it("maxSize enforcement: data exceeding maxSize triggers purge+pause", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),
        async (maxSize) => {
          const cache = new InMemoryCache();
          cache.writeQuery({
            query: WRITE_QUERY,
            data: {
              item: {
                __typename: "Item",
                id: "1",
                value: "some-value-that-is-longer-than-most-maxsize-values",
              },
            },
          });

          const storage = new MockStorage();
          const cacheAdapter = new CacheAdapter(cache);
          const storageAdapter = new StorageAdapter(storage);
          const persistor = new Persistor(cacheAdapter, storageAdapter, {
            maxSize,
          });

          await persistor.persist().catch(() => {});

          expect(persistor.isPaused).toBe(true);
          expect(await storageAdapter.read()).toBeNull();
        },
      ),
    );
  });

  it("persistenceMapper output is what gets stored", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (mapperOutput) => {
          const cache = new InMemoryCache();
          cache.writeQuery({
            query: WRITE_QUERY,
            data: {
              item: { __typename: "Item", id: "1", value: "test" },
            },
          });

          const storage = new MockStorage();
          const cacheAdapter = new CacheAdapter(cache);
          const storageAdapter = new StorageAdapter(storage);
          const persistor = new Persistor(cacheAdapter, storageAdapter, {
            persistenceMapper: async () => mapperOutput,
          });

          await persistor.persist();

          expect(await storageAdapter.read()).toBe(mapperOutput);
        },
      ),
    );
  });
});
