import { describe, it, expect } from "vitest";
import { InMemoryCache, gql } from "@apollo/client";
import { CachePersistor } from "../../CachePersistor.js";
import { MockStorage } from "../helpers/MockStorage.js";
import {
  SAMPLE_QUERY,
  SAMPLE_DATA,
  NESTED_QUERY,
  NESTED_DATA,
} from "../helpers/createTestCache.js";

async function roundTrip(cache: InMemoryCache): Promise<InMemoryCache> {
  const storage = new MockStorage();
  const persistor = new CachePersistor({
    cache,
    storage,
    trigger: false,
  });
  await persistor.persist();

  const newCache = new InMemoryCache();
  const newPersistor = new CachePersistor({
    cache: newCache,
    storage,
    trigger: false,
  });
  await newPersistor.restore();

  return newCache;
}

describe("roundTrip integration", () => {
  it("simple query data round-trips correctly", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const restored = await roundTrip(cache);
    expect(restored.extract()).toEqual(cache.extract());
  });

  it("nested normalized objects round-trip correctly", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: NESTED_QUERY, data: NESTED_DATA });

    const restored = await roundTrip(cache);
    expect(restored.extract()).toEqual(cache.extract());
  });

  it("cache with __META.extraRootIds round-trips correctly", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    // Write a standalone fragment to create an extra root ID
    cache.writeFragment({
      id: "User:standalone",
      fragment: gql`
        fragment StandaloneUser on User {
          id
          name
        }
      `,
      data: { __typename: "User", id: "standalone", name: "Standalone" },
    });

    const extracted = cache.extract();
    expect(extracted).toHaveProperty("__META");

    const restored = await roundTrip(cache);
    expect(restored.extract()).toEqual(extracted);
  });

  it("cache with null values round-trips correctly", async () => {
    const cache = new InMemoryCache();
    cache.writeQuery({
      query: gql`
        query {
          user {
            id
            name
            email
          }
        }
      `,
      data: {
        user: {
          __typename: "User",
          id: "1",
          name: null,
          email: null,
        },
      },
    });

    const restored = await roundTrip(cache);
    expect(restored.extract()).toEqual(cache.extract());
  });

  it("empty cache round-trips correctly", async () => {
    const cache = new InMemoryCache();
    const restored = await roundTrip(cache);
    expect(restored.extract()).toEqual(cache.extract());
  });

  it("large cache with many entities round-trips correctly", async () => {
    const cache = new InMemoryCache();

    // Write 500 users
    for (let i = 0; i < 500; i++) {
      cache.writeFragment({
        id: `User:${i}`,
        fragment: gql`
          fragment UserFields on User {
            id
            name
            email
          }
        `,
        data: {
          __typename: "User",
          id: String(i),
          name: `User ${i}`,
          email: `user${i}@example.com`,
        },
      });
    }

    const restored = await roundTrip(cache);
    expect(restored.extract()).toEqual(cache.extract());
  });

  it("cache with multiple query roots round-trips correctly", async () => {
    const cache = new InMemoryCache();

    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    cache.writeQuery({
      query: gql`
        query GetSettings {
          settings {
            theme
            language
          }
        }
      `,
      data: {
        settings: {
          __typename: "Settings",
          theme: "dark",
          language: "en",
        },
      },
    });

    const restored = await roundTrip(cache);
    expect(restored.extract()).toEqual(cache.extract());
  });
});
