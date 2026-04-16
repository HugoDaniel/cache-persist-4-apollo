import { describe, it, expect, vi, afterEach } from "vitest";
import { InMemoryCache } from "@apollo/client";
import { persistCache } from "../../persistCache.js";
import { CachePersistor } from "../../CachePersistor.js";
import { MockStorage } from "../helpers/MockStorage.js";
import { SAMPLE_QUERY, SAMPLE_DATA } from "../helpers/createTestCache.js";

describe("persistCache integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a CachePersistor instance", async () => {
    const cache = new InMemoryCache();
    const storage = new MockStorage();

    const result = await persistCache({
      cache,
      storage,
      trigger: false,
    });

    expect(result).toBeInstanceOf(CachePersistor);
  });

  it("restores data from storage on initialization", async () => {
    const storage = new MockStorage();

    // First: populate and persist
    const cache1 = new InMemoryCache();
    cache1.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    const persistor1 = new CachePersistor({
      cache: cache1,
      storage,
      trigger: false,
    });
    await persistor1.persist();

    // Second: create a new cache and persistCache should restore
    const cache2 = new InMemoryCache();
    await persistCache({ cache: cache2, storage, trigger: false });

    expect(cache2.extract()).toEqual(cache1.extract());
  });

  it("full round-trip: write -> debounce -> persist -> restore", async () => {
    vi.useFakeTimers();
    const storage = new MockStorage();

    // Phase 1: write data and let it persist
    const cache1 = new InMemoryCache();
    const persistor1 = new CachePersistor({ cache: cache1, storage });

    cache1.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    await vi.advanceTimersByTimeAsync(1001);

    persistor1.remove();

    // Phase 2: restore into fresh cache
    const cache2 = new InMemoryCache();
    await persistCache({ cache: cache2, storage, trigger: false });

    expect(cache2.extract()).toEqual(cache1.extract());
  });

  it("returned persistor has functional lifecycle methods", async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    const storage = new MockStorage();

    const persistor = await persistCache({ cache, storage });

    // pause should prevent persistence
    persistor.pause();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    await vi.advanceTimersByTimeAsync(2000);
    expect(storage.getItem("apollo-cache-persist")).toBeNull();

    // resume should allow persistence
    persistor.resume();
    cache.writeQuery({
      query: SAMPLE_QUERY,
      data: { ...SAMPLE_DATA, user: { ...SAMPLE_DATA.user, name: "Bob" } },
    });
    await vi.advanceTimersByTimeAsync(1001);
    expect(storage.getItem("apollo-cache-persist")).not.toBeNull();

    // remove should stop everything
    persistor.remove();
  });
});
