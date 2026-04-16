import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { InMemoryCache, gql } from "@apollo/client";
import { CacheAdapter } from "../../CacheAdapter.js";

const WRITE_QUERY = gql`
  query {
    item {
      id
      value
    }
  }
`;

function cacheWithData(id: string, value: string): InMemoryCache {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: WRITE_QUERY,
    data: {
      item: { __typename: "Item", id, value },
    },
  });
  return cache;
}

describe("CacheAdapter fuzz", () => {
  it("extract always produces parseable JSON", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (id, value) => {
          const cache = cacheWithData(id, value);
          const adapter = new CacheAdapter(cache);
          const json = adapter.extract();
          expect(() => JSON.parse(json)).not.toThrow();
        },
      ),
    );
  });

  it("round-trip preserves cache state for any data", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (id, value) => {
          const cache = cacheWithData(id, value);
          const adapter = new CacheAdapter(cache);

          const serialized = adapter.extract();

          const targetCache = new InMemoryCache();
          const targetAdapter = new CacheAdapter(targetCache);
          targetAdapter.restore(serialized);

          expect(targetCache.extract()).toEqual(cache.extract());
        },
      ),
    );
  });

  it("restore rejects arbitrary non-JSON strings", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 500 }).filter((s) => {
          try {
            JSON.parse(s);
            return false;
          } catch {
            return true;
          }
        }),
        (badString) => {
          const cache = new InMemoryCache();
          const adapter = new CacheAdapter(cache);
          expect(() => adapter.restore(badString)).toThrow();
        },
      ),
    );
  });

  it("extract is deterministic for the same cache state", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 0, maxLength: 100 }),
        (id, value) => {
          const cache = cacheWithData(id, value);
          const adapter = new CacheAdapter(cache);
          expect(adapter.extract()).toBe(adapter.extract());
        },
      ),
    );
  });
});
