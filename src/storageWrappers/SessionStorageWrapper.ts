import type { PersistentStorage } from "../types.js";

export class SessionStorageWrapper implements PersistentStorage {
  private readonly storage: Storage;

  constructor(storage: Storage) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!storage) {
      throw new Error("SessionStorageWrapper requires a storage object");
    }
    if (typeof storage.getItem !== "function") {
      throw new Error("SessionStorageWrapper requires a valid Storage implementation");
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
