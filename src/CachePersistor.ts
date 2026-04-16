import type { CachePersistorOptions } from "./types.js";
import { CacheAdapter } from "./CacheAdapter.js";
import { StorageAdapter } from "./StorageAdapter.js";
import { Persistor } from "./Persistor.js";
import { Trigger } from "./Trigger.js";

export class CachePersistor {
  private readonly persistor: Persistor;
  private readonly storageAdapter: StorageAdapter;
  private readonly trigger: Trigger;

  constructor(options: CachePersistorOptions) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!options.cache) {
      throw new Error("CachePersistor requires a cache option");
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!options.storage) {
      throw new Error("CachePersistor requires a storage option");
    }
    if (
      options.debounce !== undefined &&
      (typeof options.debounce !== "number" || options.debounce < 0)
    ) {
      throw new Error("CachePersistor debounce must be a non-negative number");
    }
    if (
      options.maxSize !== undefined &&
      options.maxSize !== false &&
      (typeof options.maxSize !== "number" || options.maxSize <= 0)
    ) {
      throw new Error("CachePersistor maxSize must be a positive number or false");
    }

    const cacheAdapter = new CacheAdapter(options.cache);
    this.storageAdapter = new StorageAdapter(options.storage, options.key);
    this.persistor = new Persistor(cacheAdapter, this.storageAdapter, {
      maxSize: options.maxSize,
      persistenceMapper: options.persistenceMapper,
      debug: options.debug,
      version: options.version,
    });
    this.trigger = new Trigger(this.persistor, options.cache, {
      trigger: options.trigger,
      debounce: options.debounce,
      onError: options.onError,
    });
  }

  public persist(): Promise<void> {
    return this.persistor.persist();
  }

  public async restore(): Promise<void> {
    this.trigger.pause();
    try {
      await this.persistor.restore();
    } finally {
      this.trigger.resume();
    }
  }

  public purge(): Promise<void> {
    return this.persistor.purge();
  }

  public pause(): void {
    this.trigger.pause();
    this.persistor.isPaused = true;
  }

  public resume(): void {
    this.trigger.resume();
    this.persistor.isPaused = false;
  }

  public remove(): void {
    this.trigger.remove();
    this.persistor.isPaused = true;
  }

  public getSize(): Promise<number> {
    return this.storageAdapter.getSize();
  }
}
