import type { ApolloCache } from "@apollo/client";

export class CacheAdapter {
  private readonly cache: ApolloCache;

  constructor(cache: ApolloCache) {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
    if (!cache) {
      throw new Error("CacheAdapter requires a cache");
    }
    if (typeof cache.extract !== "function") {
      throw new Error("CacheAdapter requires a cache with an extract method");
    }
    this.cache = cache;
  }

  public extract(): string {
    const data = this.cache.extract();
    return JSON.stringify(data);
  }

  public restore(serialized: string): void {
    if (typeof serialized !== "string") {
      throw new Error("CacheAdapter.restore requires a string argument");
    }
    if (serialized.length === 0) {
      throw new Error("CacheAdapter.restore requires a non-empty string");
    }
    const data: unknown = JSON.parse(serialized);
    this.cache.restore(data);
  }
}
