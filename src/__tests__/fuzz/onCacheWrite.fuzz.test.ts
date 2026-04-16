import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";
import { InMemoryCache, gql } from "@apollo/client";
import { onCacheWrite } from "../../onCacheWrite.js";

const WRITE_QUERY = gql`
  query {
    item {
      id
      value
    }
  }
`;

describe("onCacheWrite fuzz", () => {
  it("callback fires exactly N times for N writes", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
        const cache = new InMemoryCache();
        const callback = vi.fn();
        onCacheWrite(cache, callback);

        for (let i = 0; i < n; i++) {
          cache.writeQuery({
            query: WRITE_QUERY,
            data: {
              item: { __typename: "Item", id: String(i), value: `val-${i}` },
            },
          });
        }

        expect(callback).toHaveBeenCalledTimes(n);
      }),
    );
  });

  it("after uninstall, no further callbacks for any number of writes", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
        const cache = new InMemoryCache();
        const callback = vi.fn();
        const uninstall = onCacheWrite(cache, callback);

        uninstall();

        for (let i = 0; i < n; i++) {
          cache.writeQuery({
            query: WRITE_QUERY,
            data: {
              item: { __typename: "Item", id: String(i), value: `val-${i}` },
            },
          });
        }

        expect(callback).not.toHaveBeenCalled();
      }),
    );
  });

  it("callback exceptions never propagate to cache callers", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 100 }), (errorMsg) => {
        const cache = new InMemoryCache();
        const callback = (): void => {
          throw new Error(errorMsg);
        };
        onCacheWrite(cache, callback);

        // Should not throw despite callback throwing
        expect(() => {
          cache.writeQuery({
            query: WRITE_QUERY,
            data: {
              item: { __typename: "Item", id: "1", value: "test" },
            },
          });
        }).not.toThrow();
      }),
    );
  });

  it("write return values are preserved regardless of callback behavior", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.boolean(),
        (value, shouldThrow) => {
          const cache = new InMemoryCache();
          const callback = (): void => {
            if (shouldThrow) throw new Error("boom");
          };
          onCacheWrite(cache, callback);

          // writeQuery should still return successfully
          const result = cache.writeQuery({
            query: WRITE_QUERY,
            data: {
              item: { __typename: "Item", id: "1", value },
            },
          });

          // Result should be defined (a Reference)
          expect(result).toBeDefined();
        },
      ),
    );
  });
});
