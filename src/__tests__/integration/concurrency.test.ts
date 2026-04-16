import { describe, it, expect, vi, afterEach } from "vitest";
import { InMemoryCache } from "@apollo/client";
import { CachePersistor } from "../../CachePersistor.js";
import { MockStorage, SlowAsyncStorage } from "../helpers/MockStorage.js";
import { SAMPLE_QUERY, SAMPLE_DATA } from "../helpers/createTestCache.js";

describe("concurrency integration", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rapid writes within debounce window result in single persist", async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    const storage = new MockStorage();
    const setItemSpy = vi.spyOn(storage, "setItem");

    const persistor = new CachePersistor({ cache, storage });

    // Rapid-fire writes
    for (let i = 0; i < 10; i++) {
      cache.writeQuery({
        query: SAMPLE_QUERY,
        data: {
          ...SAMPLE_DATA,
          user: { ...SAMPLE_DATA.user, name: `User ${i}` },
        },
      });
    }

    await vi.advanceTimersByTimeAsync(1001);

    // Only one write should have occurred (debounced)
    expect(setItemSpy).toHaveBeenCalledOnce();
    persistor.remove();
  });

  it("pause during pending debounce prevents persistence", async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    const storage = new MockStorage();

    const persistor = new CachePersistor({ cache, storage });

    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    // Pause before debounce fires
    vi.advanceTimersByTime(500);
    persistor.pause();

    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.getItem("apollo-cache-persist")).toBeNull();
    persistor.remove();
  });

  it("remove during pending debounce cancels persistence", async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    const storage = new MockStorage();

    const persistor = new CachePersistor({ cache, storage });

    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    // Remove before debounce fires
    vi.advanceTimersByTime(500);
    persistor.remove();

    await vi.advanceTimersByTimeAsync(1000);

    expect(storage.getItem("apollo-cache-persist")).toBeNull();
  });

  it("multiple persist calls do not corrupt storage", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const storage = new MockStorage();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    // Fire multiple persists concurrently
    await Promise.all([
      persistor.persist(),
      persistor.persist(),
      persistor.persist(),
    ]);

    const stored = storage.getItem("apollo-cache-persist");
    expect(stored).not.toBeNull();

    // Should be valid JSON
    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveProperty("ROOT_QUERY");
  });

  it("concurrent persists with slow async storage serialize writes", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const storage = new SlowAsyncStorage(50);
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    // Fire 5 concurrent persists
    await Promise.all([
      persistor.persist(),
      persistor.persist(),
      persistor.persist(),
      persistor.persist(),
      persistor.persist(),
    ]);

    // Writes must never overlap
    expect(storage.maxConcurrentWrites).toBe(1);

    const stored = await storage.getItem("apollo-cache-persist");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveProperty("ROOT_QUERY");
  });

  it("restore waits for in-flight persist with slow async storage", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const storage = new SlowAsyncStorage(50);
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    // Start persist (takes 50ms due to slow storage)
    const persistPromise = persistor.persist();

    // Immediately call restore — should wait for persist to complete first
    const restorePromise = persistor.restore();

    await Promise.all([persistPromise, restorePromise]);

    // Restore should have read the data that persist wrote
    const extracted = cache.extract();
    expect(extracted).toHaveProperty("ROOT_QUERY");
  });

  it("persist and restore with slow storage do not interleave", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const storage = new SlowAsyncStorage(30);
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
    });

    // Interleave persist and restore calls
    await Promise.all([
      persistor.persist(),
      persistor.restore(),
      persistor.persist(),
    ]);

    // Storage writes must never overlap
    expect(storage.maxConcurrentWrites).toBeLessThanOrEqual(1);

    const stored = await storage.getItem("apollo-cache-persist");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveProperty("ROOT_QUERY");
  });

  it("persistenceMapper failure does not corrupt storage", async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const storage = new MockStorage();
    // Pre-populate storage with valid data
    storage.setItem("apollo-cache-persist", '{"existing":"data"}');

    const onError = vi.fn();
    const persistor = new CachePersistor({
      cache,
      storage,
      onError,
      persistenceMapper: async () => {
        throw new Error("mapper exploded");
      },
    });

    cache.writeQuery({
      query: SAMPLE_QUERY,
      data: { ...SAMPLE_DATA, user: { ...SAMPLE_DATA.user, name: "Updated" } },
    });

    await vi.advanceTimersByTimeAsync(1001);

    // Storage should be unchanged (mapper failed before write)
    expect(storage.getItem("apollo-cache-persist")).toBe('{"existing":"data"}');
    // Error should have surfaced via onError
    expect(onError).toHaveBeenCalledOnce();
    expect((onError.mock.calls[0][0] as Error).message).toBe(
      "mapper exploded",
    );
    persistor.remove();
  });

  it("persistenceMapper failure does not block subsequent debounced persists", async () => {
    vi.useFakeTimers();
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const storage = new MockStorage();
    let callCount = 0;
    const persistor = new CachePersistor({
      cache,
      storage,
      persistenceMapper: async (data) => {
        callCount++;
        if (callCount === 1) throw new Error("first mapper call fails");
        return data;
      },
    });

    // First debounced persist (will fail in mapper)
    cache.writeQuery({
      query: SAMPLE_QUERY,
      data: { ...SAMPLE_DATA, user: { ...SAMPLE_DATA.user, name: "First" } },
    });
    await vi.advanceTimersByTimeAsync(1001);

    // Second debounced persist (should succeed)
    cache.writeQuery({
      query: SAMPLE_QUERY,
      data: { ...SAMPLE_DATA, user: { ...SAMPLE_DATA.user, name: "Second" } },
    });
    await vi.advanceTimersByTimeAsync(1001);

    const stored = storage.getItem("apollo-cache-persist");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveProperty("ROOT_QUERY");
    persistor.remove();
  });

  it("persist error does not block subsequent persists", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const storage = new MockStorage();
    let callCount = 0;
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
      persistenceMapper: async (data) => {
        callCount++;
        if (callCount === 1) throw new Error("mapper failed");
        return data;
      },
    });

    // First persist fails
    await expect(persistor.persist()).rejects.toThrow("mapper failed");

    // Second persist succeeds
    await persistor.persist();

    const stored = storage.getItem("apollo-cache-persist");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveProperty("ROOT_QUERY");
  });
});
