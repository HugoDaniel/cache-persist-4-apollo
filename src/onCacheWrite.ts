import type { ApolloCache } from "@apollo/client";
import type { Cache } from "@apollo/client/cache";
import type { Reference } from "@apollo/client/utilities";

export function onCacheWrite(
  cache: ApolloCache,
  callback: () => void,
): () => void {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
  if (!cache) {
    throw new Error("onCacheWrite requires a cache");
  }
  if (typeof callback !== "function") {
    throw new Error("onCacheWrite requires a callback function");
  }

  /* eslint-disable @typescript-eslint/unbound-method --
     We store method references and re-bind them via .call(this, ...) in our
     wrappers, so `this` is always correct at call time. */
  const originalWrite = cache.write;
  const originalModify = cache.modify;
  const originalEvict = cache.evict;
  const originalGc = cache.gc;
  /* eslint-enable @typescript-eslint/unbound-method */

  cache.write = function <
    TData = unknown,
    TVariables extends Record<string, unknown> = Record<string, unknown>,
  >(
    this: ApolloCache,
    options: Cache.WriteOptions<TData, TVariables>,
  ): Reference | undefined {
    const result = originalWrite.call(this, options);
    try {
      callback();
    } catch {
      // Persist callback errors must never propagate to cache callers
    }
    return result;
  };

  // The modify method has a generic constraint that causes variance issues
  // when reassigning. We use a type assertion since our wrapper preserves
  // the exact behavior of the original method.
  cache.modify = function (
    this: ApolloCache,
    options: Cache.ModifyOptions,
  ): boolean {
    const result = originalModify.call(this, options);
    try {
      callback();
    } catch {
      // Persist callback errors must never propagate to cache callers
    }
    return result;
  } as typeof cache.modify;

  cache.evict = function (
    this: ApolloCache,
    options: Cache.EvictOptions,
  ): boolean {
    const result = originalEvict.call(this, options);
    try {
      callback();
    } catch {
      // Persist callback errors must never propagate to cache callers
    }
    return result;
  };

  cache.gc = function (this: ApolloCache): string[] {
    const result = originalGc.call(this);
    try {
      callback();
    } catch {
      // Persist callback errors must never propagate to cache callers
    }
    return result;
  };

  return (): void => {
    cache.write = originalWrite;
    cache.modify = originalModify;
    cache.evict = originalEvict;
    cache.gc = originalGc;
  };
}
