import { describe, it, expect, vi } from "vitest";
import { gql } from "@apollo/client";
import { onCacheWrite } from "../onCacheWrite.js";
import {
  createTestCache,
  SAMPLE_QUERY,
  SAMPLE_DATA,
} from "./helpers/createTestCache.js";

describe("onCacheWrite", () => {
  it("callback fires after cache.writeQuery", () => {
    const cache = createTestCache();
    const callback = vi.fn();
    onCacheWrite(cache, callback);

    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    expect(callback).toHaveBeenCalled();
  });

  it("callback fires after cache.writeFragment", () => {
    const cache = createTestCache();
    const callback = vi.fn();
    onCacheWrite(cache, callback);

    cache.writeFragment({
      id: "User:1",
      fragment: gql`
        fragment UserName on User {
          name
        }
      `,
      data: { __typename: "User", name: "Alice" },
    });

    expect(callback).toHaveBeenCalled();
  });

  it("callback fires after cache.modify", () => {
    const cache = createTestCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const callback = vi.fn();
    onCacheWrite(cache, callback);

    cache.modify({
      id: "User:1",
      fields: {
        name: () => "Bob",
      },
    });

    expect(callback).toHaveBeenCalled();
  });

  it("callback fires after cache.evict", () => {
    const cache = createTestCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    const callback = vi.fn();
    onCacheWrite(cache, callback);

    cache.evict({ id: "User:1" });

    expect(callback).toHaveBeenCalled();
  });

  it("callback fires after cache.gc", () => {
    const cache = createTestCache();
    const callback = vi.fn();
    onCacheWrite(cache, callback);

    cache.gc();

    expect(callback).toHaveBeenCalled();
  });

  it("uninstall restores original methods", () => {
    const cache = createTestCache();
    const originalWrite = cache.write;
    const originalModify = cache.modify;
    const originalEvict = cache.evict;
    const originalGc = cache.gc;

    const uninstall = onCacheWrite(cache, vi.fn());

    expect(cache.write).not.toBe(originalWrite);
    expect(cache.modify).not.toBe(originalModify);
    expect(cache.evict).not.toBe(originalEvict);
    expect(cache.gc).not.toBe(originalGc);

    uninstall();

    expect(cache.write).toBe(originalWrite);
    expect(cache.modify).toBe(originalModify);
    expect(cache.evict).toBe(originalEvict);
    expect(cache.gc).toBe(originalGc);
  });

  it("after uninstall, callback no longer fires", () => {
    const cache = createTestCache();
    const callback = vi.fn();

    const uninstall = onCacheWrite(cache, callback);
    uninstall();

    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    expect(callback).not.toHaveBeenCalled();
  });

  it("preserves write return value", () => {
    const cache = createTestCache();
    onCacheWrite(cache, vi.fn());

    const result = cache.writeQuery({
      query: SAMPLE_QUERY,
      data: SAMPLE_DATA,
    });

    // writeQuery returns a Reference or undefined
    expect(result).toBeDefined();
  });

  it("preserves modify return value", () => {
    const cache = createTestCache();
    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });

    onCacheWrite(cache, vi.fn());

    const result = cache.modify({
      id: "User:1",
      fields: { name: () => "Bob" },
    });

    expect(typeof result).toBe("boolean");
  });

  it("preserves gc return value", () => {
    const cache = createTestCache();
    onCacheWrite(cache, vi.fn());

    const result = cache.gc();
    expect(Array.isArray(result)).toBe(true);
  });

  it("callback fires multiple times for multiple writes", () => {
    const cache = createTestCache();
    const callback = vi.fn();
    onCacheWrite(cache, callback);

    cache.writeQuery({ query: SAMPLE_QUERY, data: SAMPLE_DATA });
    cache.writeQuery({
      query: SAMPLE_QUERY,
      data: { ...SAMPLE_DATA, user: { ...SAMPLE_DATA.user, name: "Bob" } },
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
