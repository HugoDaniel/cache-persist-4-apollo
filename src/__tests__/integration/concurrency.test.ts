import { describe, it, expect, vi, afterEach } from "vitest";
import { InMemoryCache } from "@apollo/client";
import { CachePersistor } from "../../CachePersistor.js";
import { MockStorage } from "../helpers/MockStorage.js";
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
});
