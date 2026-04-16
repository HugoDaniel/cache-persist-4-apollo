import type { PersistentStorage } from "../types.js";

export class LocalStorageWrapper implements PersistentStorage {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!storage) {
      throw new Error("LocalStorageWrapper requires a storage object");
    }
    if (typeof storage.getItem !== "function") {
      throw new Error("LocalStorageWrapper requires a valid Storage implementation");
    }
    try {
      const testKey = "__apollo_cache_persist_test__";
      storage.setItem(testKey, "1");
      storage.removeItem(testKey);
    } catch {
      throw new Error(
        "LocalStorageWrapper: storage is not writable (private browsing, disabled, or sandboxed)",
      );
    }
    this.storage = storage;
  }

  public getItem(key: string): string | null {
    return this.storage.getItem(key);
  }

  public setItem(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  public removeItem(key: string): void {
    this.storage.removeItem(key);
  }
}
