import type { PersistentStorage } from "../../types.js";

export class MockStorage implements PersistentStorage<string> {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class MockAsyncStorage implements PersistentStorage<string> {
  private store = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class FailingStorage implements PersistentStorage<string> {
  getItem(): string | null {
    throw new Error("Storage read failed");
  }

  setItem(): void {
    throw new Error("Storage write failed");
  }

  removeItem(): void {
    throw new Error("Storage remove failed");
  }
}
