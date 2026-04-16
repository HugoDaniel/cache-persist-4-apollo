import { describe, it, expect } from "vitest";
import { gql } from "@apollo/client";
import { CacheAdapter } from "../CacheAdapter.js";
import {
  createTestCache,
  createPopulatedCache,
  SAMPLE_QUERY,
  SAMPLE_DATA,
  NESTED_QUERY,
  NESTED_DATA,
} from "./helpers/createTestCache.js";

describe("CacheAdapter", () => {
  it("extract returns a JSON string of cache contents", () => {
    const cache = createPopulatedCache();
    const adapter = new CacheAdapter(cache);

    const result = adapter.extract();

    expect(typeof result).toBe("string");
    const parsed = JSON.parse(result);
    expect(parsed.ROOT_QUERY).toBeDefined();
    expect(parsed.ROOT_QUERY.hello).toBe("world");
  });

  it("extract returns empty cache as JSON object", () => {
    const cache = createTestCache();
    const adapter = new CacheAdapter(cache);

    const result = adapter.extract();
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({});
  });

  it("restore parses JSON and restores to cache", () => {
    const sourceCache = createPopulatedCache();
    const sourceAdapter = new CacheAdapter(sourceCache);
    const serialized = sourceAdapter.extract();

    const targetCache = createTestCache();
    const targetAdapter = new CacheAdapter(targetCache);
    targetAdapter.restore(serialized);

    expect(targetCache.extract()).toEqual(sourceCache.extract());
  });

  it("round-trips nested normalized objects", () => {
    const cache = createTestCache();
    cache.writeQuery({
      query: NESTED_QUERY,
      data: NESTED_DATA,
    });

    const adapter = new CacheAdapter(cache);
    const serialized = adapter.extract();

    const targetCache = createTestCache();
    const targetAdapter = new CacheAdapter(targetCache);
    targetAdapter.restore(serialized);

    expect(targetCache.extract()).toEqual(cache.extract());
  });

  it("preserves __META.extraRootIds in round-trip", () => {
    const cache = createTestCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    // Write a fragment directly (creates an extraRootId)
    cache.writeFragment({
      id: "User:99",
      fragment: gql`
        fragment UserFields on User {
          id
          name
        }
      `,
      data: { __typename: "User", id: "99", name: "Bob" },
    });

    const extracted = cache.extract();
    // Verify __META exists with extraRootIds
    expect(extracted).toHaveProperty("__META");

    const adapter = new CacheAdapter(cache);
    const serialized = adapter.extract();

    const targetCache = createTestCache();
    const targetAdapter = new CacheAdapter(targetCache);
    targetAdapter.restore(serialized);

    expect(targetCache.extract()).toEqual(extracted);
  });

  it("restore throws on invalid JSON", () => {
    const cache = createTestCache();
    const adapter = new CacheAdapter(cache);

    expect(() => adapter.restore("not valid json{{{")).toThrow();
  });

  it("restore handles null values in data", () => {
    const cache = createTestCache();
    cache.writeQuery({
      query: gql`
        query {
          user {
            id
            name
          }
        }
      `,
      data: { user: { __typename: "User", id: "1", name: null } },
    });

    const adapter = new CacheAdapter(cache);
    const serialized = adapter.extract();

    const targetCache = createTestCache();
    const targetAdapter = new CacheAdapter(targetCache);
    targetAdapter.restore(serialized);

    expect(targetCache.extract()).toEqual(cache.extract());
  });
});
