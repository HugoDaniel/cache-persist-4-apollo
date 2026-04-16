import { describe, it, expect, vi, beforeEach } from "vitest";
import { Persistor } from "../Persistor.js";
import { CacheAdapter } from "../CacheAdapter.js";
import { StorageAdapter } from "../StorageAdapter.js";
import { CacheCorruptionError, MaxSizeExceededError } from "../errors.js";
import { MockStorage } from "./helpers/MockStorage.js";
import { createPopulatedCache } from "./helpers/createTestCache.js";

describe("Persistor", () => {
  let cacheAdapter: CacheAdapter;
  let storageAdapter: StorageAdapter;
  let storage: MockStorage;

  beforeEach(() => {
    const cache = createPopulatedCache();
    cacheAdapter = new CacheAdapter(cache);
    storage = new MockStorage();
    storageAdapter = new StorageAdapter(storage);
  });

  it("persist extracts cache and writes to storage", async () => {
    const persistor = new Persistor(cacheAdapter, storageAdapter, {});

    await persistor.persist();

    const stored = await storageAdapter.read();
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!)).toHaveProperty("ROOT_QUERY");
  });

  it("persist does nothing when paused", async () => {
    const persistor = new Persistor(cacheAdapter, storageAdapter, {});
    persistor.isPaused = true;

    await persistor.persist();

    expect(await storageAdapter.read()).toBeNull();
  });

  it("persist purges and pauses when maxSize is exceeded", async () => {
    // First write some data to storage
    await storageAdapter.write("existing data");

    const persistor = new Persistor(cacheAdapter, storageAdapter, {
      maxSize: 10, // Very small to trigger
    });

    await expect(persistor.persist()).rejects.toThrow(MaxSizeExceededError);

    expect(await storageAdapter.read()).toBeNull(); // purged
    expect(persistor.isPaused).toBe(true);
  });

  it("MaxSizeExceededError includes dataSize and maxSize", async () => {
    const persistor = new Persistor(cacheAdapter, storageAdapter, {
      maxSize: 10,
    });

    try {
      await persistor.persist();
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(MaxSizeExceededError);
      const msError = error as MaxSizeExceededError;
      expect(msError.maxSize).toBe(10);
      expect(msError.dataSize).toBeGreaterThan(10);
    }
  });

  it("persist writes normally when under maxSize", async () => {
    const persistor = new Persistor(cacheAdapter, storageAdapter, {
      maxSize: 1_000_000,
    });

    await persistor.persist();

    expect(await storageAdapter.read()).not.toBeNull();
    expect(persistor.isPaused).toBe(false);
  });

  it("persist applies persistenceMapper before writing", async () => {
    const mapper = vi.fn(async (data: string) => {
      const parsed = JSON.parse(data);
      delete parsed["ROOT_QUERY"];
      return JSON.stringify(parsed);
    });

    const persistor = new Persistor(cacheAdapter, storageAdapter, {
      persistenceMapper: mapper,
    });

    await persistor.persist();

    expect(mapper).toHaveBeenCalledOnce();
    const stored = JSON.parse((await storageAdapter.read())!);
    expect(stored).not.toHaveProperty("ROOT_QUERY");
  });

  it("persist applies mapper before maxSize check", async () => {
    // Mapper shrinks data to fit within maxSize
    const mapper = vi.fn(async () => "tiny");

    const persistor = new Persistor(cacheAdapter, storageAdapter, {
      maxSize: 10,
      persistenceMapper: mapper,
    });

    await persistor.persist();

    expect(await storageAdapter.read()).toBe("tiny");
    expect(persistor.isPaused).toBe(false);
  });

  it("persist with maxSize: false disables size checking", async () => {
    const persistor = new Persistor(cacheAdapter, storageAdapter, {
      maxSize: false,
    });

    await persistor.persist();

    expect(await storageAdapter.read()).not.toBeNull();
  });

  it("restore reads from storage and restores to cache", async () => {
    // Persist first
    const persistor = new Persistor(cacheAdapter, storageAdapter, {});
    await persistor.persist();

    // Restore into a fresh cache
    const freshCache = createPopulatedCache();
    const freshCacheAdapter = new CacheAdapter(freshCache);
    const restorePersistor = new Persistor(
      freshCacheAdapter,
      storageAdapter,
      {},
    );

    await restorePersistor.restore();

    // Data should match
    expect(freshCacheAdapter.extract()).toBe(cacheAdapter.extract());
  });

  it("restore does nothing when storage is empty", async () => {
    const persistor = new Persistor(cacheAdapter, storageAdapter, {});
    const extractBefore = cacheAdapter.extract();

    await persistor.restore();

    expect(cacheAdapter.extract()).toBe(extractBefore);
  });

  it("restore throws CacheCorruptionError on corrupt data and purges", async () => {
    storage.setItem("apollo-cache-persist", "not valid json{{{");

    const persistor = new Persistor(cacheAdapter, storageAdapter, {});

    await expect(persistor.restore()).rejects.toThrow(CacheCorruptionError);
    // Storage should be purged
    expect(await storageAdapter.read()).toBeNull();
  });

  it("purge clears storage", async () => {
    await storageAdapter.write("some data");
    const persistor = new Persistor(cacheAdapter, storageAdapter, {});

    await persistor.purge();

    expect(await storageAdapter.read()).toBeNull();
  });

  it("isPaused getter and setter work", () => {
    const persistor = new Persistor(cacheAdapter, storageAdapter, {});

    expect(persistor.isPaused).toBe(false);
    persistor.isPaused = true;
    expect(persistor.isPaused).toBe(true);
    persistor.isPaused = false;
    expect(persistor.isPaused).toBe(false);
  });

  describe("version stamping", () => {
    it("persisted data includes version envelope", async () => {
      const persistor = new Persistor(cacheAdapter, storageAdapter, {
        version: 1,
      });

      await persistor.persist();

      const raw = await storageAdapter.read();
      const envelope = JSON.parse(raw!);
      expect(envelope).toHaveProperty("__version", 1);
      expect(typeof envelope.data).toBe("string");
    });

    it("matching version restores successfully", async () => {
      const persistor = new Persistor(cacheAdapter, storageAdapter, {
        version: "v1",
      });
      await persistor.persist();

      const freshCache = createPopulatedCache();
      const freshCacheAdapter = new CacheAdapter(freshCache);
      const restorePersistor = new Persistor(
        freshCacheAdapter,
        storageAdapter,
        { version: "v1" },
      );
      await restorePersistor.restore();

      expect(freshCacheAdapter.extract()).toBe(cacheAdapter.extract());
    });

    it("mismatched version purges and does not restore", async () => {
      const persistor = new Persistor(cacheAdapter, storageAdapter, {
        version: 1,
      });
      await persistor.persist();

      const freshCache = createPopulatedCache();
      const freshCacheAdapter = new CacheAdapter(freshCache);
      const extractBefore = freshCacheAdapter.extract();
      const restorePersistor = new Persistor(
        freshCacheAdapter,
        storageAdapter,
        { version: 2 },
      );
      await restorePersistor.restore();

      // Cache unchanged (nothing restored)
      expect(freshCacheAdapter.extract()).toBe(extractBefore);
      // Storage purged
      expect(await storageAdapter.read()).toBeNull();
    });

    it("unversioned storage data purged when version is set", async () => {
      // Write raw (no version) data
      const persistor = new Persistor(cacheAdapter, storageAdapter, {});
      await persistor.persist();
      expect(await storageAdapter.read()).not.toBeNull();

      // Restore with version set — old data should be purged
      const freshCache = createPopulatedCache();
      const freshCacheAdapter = new CacheAdapter(freshCache);
      const extractBefore = freshCacheAdapter.extract();
      const restorePersistor = new Persistor(
        freshCacheAdapter,
        storageAdapter,
        { version: 1 },
      );
      await restorePersistor.restore();

      expect(freshCacheAdapter.extract()).toBe(extractBefore);
      expect(await storageAdapter.read()).toBeNull();
    });

    it("no version preserves existing behavior", async () => {
      const persistor = new Persistor(cacheAdapter, storageAdapter, {});
      await persistor.persist();

      const freshCache = createPopulatedCache();
      const freshCacheAdapter = new CacheAdapter(freshCache);
      const restorePersistor = new Persistor(
        freshCacheAdapter,
        storageAdapter,
        {},
      );
      await restorePersistor.restore();

      expect(freshCacheAdapter.extract()).toBe(cacheAdapter.extract());
    });
  });
});
