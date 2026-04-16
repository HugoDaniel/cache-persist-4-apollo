import { describe, it, expect } from "vitest";
import { InMemoryCache } from "@apollo/client";
import { CachePersistor } from "../../CachePersistor.js";
import { CacheCorruptionError } from "../../errors.js";
import { MockStorage, FailingStorage } from "../helpers/MockStorage.js";
import { SAMPLE_QUERY, SAMPLE_DATA } from "../helpers/createTestCache.js";

describe("corruption integration", () => {
  it("restore with truncated JSON throws CacheCorruptionError", async () => {
    const storage = new MockStorage();
    storage.setItem("apollo-cache-persist", '{"ROOT_QUERY":{"hello":"wor');

    const cache = new InMemoryCache();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    await expect(persistor.restore()).rejects.toThrow(CacheCorruptionError);
  });

  it("restore with non-JSON data throws CacheCorruptionError", async () => {
    const storage = new MockStorage();
    storage.setItem("apollo-cache-persist", "this is not json at all");

    const cache = new InMemoryCache();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    await expect(persistor.restore()).rejects.toThrow(CacheCorruptionError);
  });

  it("storage is purged after corruption", async () => {
    const storage = new MockStorage();
    storage.setItem("apollo-cache-persist", "corrupt data");

    const cache = new InMemoryCache();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    try {
      await persistor.restore();
    } catch {
      // expected
    }

    expect(storage.getItem("apollo-cache-persist")).toBeNull();
  });

  it("recovery after corruption: subsequent persists work", async () => {
    const storage = new MockStorage();
    storage.setItem("apollo-cache-persist", "corrupt");

    const cache = new InMemoryCache();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    try {
      await persistor.restore();
    } catch {
      // expected
    }

    // Write data and persist again
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    await persistor.persist();

    const stored = storage.getItem("apollo-cache-persist");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveProperty("ROOT_QUERY");
  });

  it("restore with empty storage does not throw", async () => {
    const storage = new MockStorage();
    const cache = new InMemoryCache();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    await expect(persistor.restore()).resolves.toBeUndefined();
  });

  it("storage read error propagates", async () => {
    const storage = new FailingStorage();
    const cache = new InMemoryCache();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    await expect(persistor.restore()).rejects.toThrow("Storage read failed");
  });

  it("storage write error propagates", async () => {
    const storage = new FailingStorage();
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    await expect(persistor.persist()).rejects.toThrow("Storage write failed");
  });
});
