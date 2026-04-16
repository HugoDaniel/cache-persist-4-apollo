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

export class SlowAsyncStorage implements PersistentStorage<string> {
  private store = new Map<string, string>();
  public writeDelay: number;
  public concurrentWrites = 0;
  public maxConcurrentWrites = 0;

  constructor(writeDelay = 50) {
    this.writeDelay = writeDelay;
  }

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.concurrentWrites++;
    if (this.concurrentWrites > this.maxConcurrentWrites) {
      this.maxConcurrentWrites = this.concurrentWrites;
    }
    await new Promise((r) => setTimeout(r, this.writeDelay));
    this.store.set(key, value);
    this.concurrentWrites--;
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

export class QuotaExceedingStorage implements PersistentStorage<string> {
  private store = new Map<string, string>();
  public quotaLimit: number;

  constructor(quotaLimit = 100) {
    this.quotaLimit = quotaLimit;
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (value.length > this.quotaLimit) {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    }
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
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
