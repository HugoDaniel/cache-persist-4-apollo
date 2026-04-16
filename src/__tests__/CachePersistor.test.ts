import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CachePersistor } from "../CachePersistor.js";
import { MockStorage } from "./helpers/MockStorage.js";
import {
  createTestCache,
  createPopulatedCache,
  SAMPLE_QUERY,
  SAMPLE_DATA,
} from "./helpers/createTestCache.js";

describe("CachePersistor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when cache option is missing", () => {
    expect(
      () =>
        new CachePersistor({
          cache: undefined as any,
          storage: new MockStorage(),
        }),
    ).toThrow("CachePersistor requires a cache option");
  });

  it("throws when storage option is missing", () => {
    expect(
      () =>
        new CachePersistor({
          cache: createTestCache(),
          storage: undefined as any,
        }),
    ).toThrow("CachePersistor requires a storage option");
  });

  it("persist writes cache data to storage", async () => {
    const cache = createPopulatedCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({ cache, storage, trigger: false });

    await persistor.persist();

    const stored = storage.getItem("apollo-cache-persist");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveProperty("ROOT_QUERY");
  });

  it("restore loads data from storage into cache", async () => {
    const cache = createPopulatedCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({ cache, storage, trigger: false });

    await persistor.persist();

    // Create a new cache and restore into it
    const newCache = createTestCache();
    const newPersistor = new CachePersistor({
      cache: newCache,
      storage,
      trigger: false,
    });

    await newPersistor.restore();

    expect(newCache.extract()).toEqual(cache.extract());
  });

  it("purge removes data from storage", async () => {
    const cache = createPopulatedCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({ cache, storage, trigger: false });

    await persistor.persist();
    expect(storage.getItem("apollo-cache-persist")).not.toBeNull();

    await persistor.purge();
    expect(storage.getItem("apollo-cache-persist")).toBeNull();
  });

  it("pause prevents automatic persistence", async () => {
    const cache = createTestCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({ cache, storage });

    persistor.pause();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    vi.advanceTimersByTime(2000);
    // Wait for any pending microtasks
    await vi.runAllTimersAsync();

    expect(storage.getItem("apollo-cache-persist")).toBeNull();
  });

  it("resume allows automatic persistence after pause", async () => {
    const cache = createTestCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({ cache, storage });

    persistor.pause();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    vi.advanceTimersByTime(2000);

    persistor.resume();
    cache.writeQuery({
      query: SAMPLE_QUERY,
      data: { ...SAMPLE_DATA, user: { ...SAMPLE_DATA.user, name: "Bob" } },
    });

    await vi.advanceTimersByTimeAsync(1001);

    expect(storage.getItem("apollo-cache-persist")).not.toBeNull();
  });

  it("remove stops all automatic persistence", async () => {
    const cache = createTestCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({ cache, storage });

    persistor.remove();

    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    await vi.advanceTimersByTimeAsync(2000);

    expect(storage.getItem("apollo-cache-persist")).toBeNull();
  });

  it("getSize returns size of persisted data", async () => {
    const cache = createPopulatedCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({ cache, storage, trigger: false });

    expect(await persistor.getSize()).toBe(0);

    await persistor.persist();

    const size = await persistor.getSize();
    expect(size).toBeGreaterThan(0);
  });

  it("respects custom storage key", async () => {
    const cache = createPopulatedCache();
    const storage = new MockStorage();
    const persistor = new CachePersistor({
      cache,
      storage,
      trigger: false,
      key: "my-cache",
    });

    await persistor.persist();

    expect(storage.getItem("my-cache")).not.toBeNull();
    expect(storage.getItem("apollo-cache-persist")).toBeNull();
  });
});
