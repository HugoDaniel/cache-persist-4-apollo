import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Trigger } from "../Trigger.js";
import { Persistor } from "../Persistor.js";
import { CacheAdapter } from "../CacheAdapter.js";
import { StorageAdapter } from "../StorageAdapter.js";
import { MockStorage } from "./helpers/MockStorage.js";
import { createPopulatedCache } from "./helpers/createTestCache.js";

describe("Trigger", () => {
  let persistor: Persistor;

  beforeEach(() => {
    vi.useFakeTimers();
    const cache = createPopulatedCache();
    const cacheAdapter = new CacheAdapter(cache);
    const storage = new MockStorage();
    const storageAdapter = new StorageAdapter(storage);
    persistor = new Persistor(cacheAdapter, storageAdapter, {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("default debounce is 1000ms", () => {
    expect(Trigger.DEFAULT_DEBOUNCE).toBe(1000);
  });

  it("fire debounces with default 1000ms", () => {
    const persistSpy = vi.spyOn(persistor, "persist");
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, { trigger: false });
    trigger.fire();

    expect(persistSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1001);

    expect(persistSpy).toHaveBeenCalledOnce();
  });

  it("fire uses custom debounce interval", () => {
    const persistSpy = vi.spyOn(persistor, "persist");
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, {
      trigger: false,
      debounce: 500,
    });
    trigger.fire();

    vi.advanceTimersByTime(499);
    expect(persistSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(persistSpy).toHaveBeenCalledOnce();
  });

  it("fire with debounce 0 persists immediately", () => {
    const persistSpy = vi.spyOn(persistor, "persist");
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, {
      trigger: false,
      debounce: 0,
    });
    trigger.fire();

    expect(persistSpy).toHaveBeenCalledOnce();
  });

  it("multiple fires within debounce window collapse to one persist", () => {
    const persistSpy = vi.spyOn(persistor, "persist");
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, {
      trigger: false,
      debounce: 1000,
    });
    trigger.fire();
    trigger.fire();
    trigger.fire();

    vi.advanceTimersByTime(1001);

    expect(persistSpy).toHaveBeenCalledOnce();
  });

  it("trigger: false does not install any trigger", () => {
    const cache = createPopulatedCache();
    const originalWrite = cache.write;

    new Trigger(persistor, cache, { trigger: false });

    // cache.write should not be patched
    expect(cache.write).toBe(originalWrite);
  });

  it("trigger: 'write' installs cache write interception", () => {
    const cache = createPopulatedCache();
    const originalWrite = cache.write;

    new Trigger(persistor, cache, { trigger: "write" });

    // cache.write should be patched
    expect(cache.write).not.toBe(originalWrite);
  });

  it("pause prevents fire from scheduling persist", () => {
    const persistSpy = vi.spyOn(persistor, "persist");
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, { trigger: false });
    trigger.pause();
    trigger.fire();

    vi.advanceTimersByTime(2000);

    expect(persistSpy).not.toHaveBeenCalled();
  });

  it("resume allows fire to schedule persist again", () => {
    const persistSpy = vi.spyOn(persistor, "persist");
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, { trigger: false });
    trigger.pause();
    trigger.fire();

    vi.advanceTimersByTime(2000);
    expect(persistSpy).not.toHaveBeenCalled();

    trigger.resume();
    trigger.fire();

    vi.advanceTimersByTime(1001);
    expect(persistSpy).toHaveBeenCalledOnce();
  });

  it("remove uninstalls trigger and clears pending timeout", () => {
    const persistSpy = vi.spyOn(persistor, "persist");
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, { trigger: "write" });

    trigger.fire(); // schedule a persist
    trigger.remove();

    vi.advanceTimersByTime(2000);

    expect(persistSpy).not.toHaveBeenCalled();
    // After remove, cache methods should be restored
    // (write was patched and should be unpatched now — but the
    // reference may differ since Trigger doesn't expose originals.
    // At minimum, fire should no longer work)
    trigger.fire();
    vi.advanceTimersByTime(2000);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it("remove is idempotent", () => {
    const cache = createPopulatedCache();
    const trigger = new Trigger(persistor, cache, { trigger: "write" });

    // Should not throw on multiple calls
    trigger.remove();
    trigger.remove();
    trigger.remove();
  });

  it("custom trigger function receives fire and returns uninstall", () => {
    const uninstallFn = vi.fn();
    const customTrigger = vi.fn(() => uninstallFn);
    const cache = createPopulatedCache();

    const trigger = new Trigger(persistor, cache, {
      trigger: customTrigger,
    });

    expect(customTrigger).toHaveBeenCalledOnce();
    expect(customTrigger).toHaveBeenCalledWith(trigger.fire);

    trigger.remove();
    expect(uninstallFn).toHaveBeenCalledOnce();
  });
});
