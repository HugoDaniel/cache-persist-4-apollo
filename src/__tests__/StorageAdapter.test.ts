import { describe, it, expect } from "vitest";
import { StorageAdapter } from "../StorageAdapter.js";
import { MockStorage, MockAsyncStorage } from "./helpers/MockStorage.js";

describe("StorageAdapter", () => {
  it("read returns null when key does not exist", async () => {
    const storage = new MockStorage();
    const adapter = new StorageAdapter(storage);

    expect(await adapter.read()).toBeNull();
  });

  it("write stores data and read retrieves it", async () => {
    const storage = new MockStorage();
    const adapter = new StorageAdapter(storage);

    await adapter.write('{"hello":"world"}');
    expect(await adapter.read()).toBe('{"hello":"world"}');
  });

  it("purge removes stored data", async () => {
    const storage = new MockStorage();
    const adapter = new StorageAdapter(storage);

    await adapter.write('{"data":true}');
    await adapter.purge();
    expect(await adapter.read()).toBeNull();
  });

  it("getSize returns 0 when empty", async () => {
    const storage = new MockStorage();
    const adapter = new StorageAdapter(storage);

    expect(await adapter.getSize()).toBe(0);
  });

  it("getSize returns string length of stored data", async () => {
    const storage = new MockStorage();
    const adapter = new StorageAdapter(storage);
    const data = '{"hello":"world"}';

    await adapter.write(data);
    expect(await adapter.getSize()).toBe(data.length);
  });

  it("uses default key 'apollo-cache-persist'", async () => {
    const storage = new MockStorage();
    const adapter = new StorageAdapter(storage);

    await adapter.write("test");
    expect(storage.getItem("apollo-cache-persist")).toBe("test");
  });

  it("respects custom key", async () => {
    const storage = new MockStorage();
    const adapter = new StorageAdapter(storage, "custom-key");

    await adapter.write("test");
    expect(storage.getItem("custom-key")).toBe("test");
    expect(storage.getItem("apollo-cache-persist")).toBeNull();
  });

  it("works with async storage implementations", async () => {
    const storage = new MockAsyncStorage();
    const adapter = new StorageAdapter(storage);

    await adapter.write('{"async":true}');
    expect(await adapter.read()).toBe('{"async":true}');

    await adapter.purge();
    expect(await adapter.read()).toBeNull();
  });

  it("multiple adapters with different keys do not interfere", async () => {
    const storage = new MockStorage();
    const adapter1 = new StorageAdapter(storage, "key1");
    const adapter2 = new StorageAdapter(storage, "key2");

    await adapter1.write("data1");
    await adapter2.write("data2");

    expect(await adapter1.read()).toBe("data1");
    expect(await adapter2.read()).toBe("data2");
  });
});
