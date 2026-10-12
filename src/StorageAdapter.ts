import type { PersistentStorage } from "./types.js";
import { StorageQuotaError } from "./errors.js";

export class StorageAdapter {
  private readonly key: string;
  private readonly storage: PersistentStorage;

  constructor(
    storage: PersistentStorage,
    key = "apollo-cache-persist",
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!storage) {
      throw new Error("StorageAdapter requires a storage");
    }
    if (!key || typeof key !== "string") {
      throw new Error("StorageAdapter requires a non-empty string key");
    }
    this.storage = storage;
    this.key = key;
  }

  public async read(): Promise<string | null> {
    return this.storage.getItem(this.key);
  }

  public async write(data: string): Promise<void> {
    try {
      await this.storage.setItem(this.key, data);
    } catch (error) {
      // React Native's Hermes runtime has no global DOMException.
      if (
        typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        throw new StorageQuotaError(
          "Storage quota exceeded while persisting cache",
          { cause: error },
        );
      }
      throw error;
    }
  }

  public async purge(): Promise<void> {
    await this.storage.removeItem(this.key);
  }

  public async getSize(): Promise<number> {
    const data = await this.storage.getItem(this.key);
    return data ? data.length : 0;
  }
}
