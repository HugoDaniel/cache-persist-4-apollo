import { describe, it, expect, beforeEach } from "vitest";
import { LocalStorageWrapper } from "../../storageWrappers/LocalStorageWrapper.js";

describe("LocalStorageWrapper", () => {
  let wrapper: LocalStorageWrapper;

  beforeEach(() => {
    localStorage.clear();
    wrapper = new LocalStorageWrapper(localStorage);
  });

  it("getItem returns null when key does not exist", () => {
    expect(wrapper.getItem("nonexistent")).toBeNull();
  });

  it("setItem stores a value", () => {
    wrapper.setItem("key", "value");
    expect(localStorage.getItem("key")).toBe("value");
  });

  it("getItem retrieves a stored value", () => {
    localStorage.setItem("key", "value");
    expect(wrapper.getItem("key")).toBe("value");
  });

  it("removeItem removes a stored value", () => {
    localStorage.setItem("key", "value");
    wrapper.removeItem("key");
    expect(localStorage.getItem("key")).toBeNull();
  });

  it("handles empty string values", () => {
    wrapper.setItem("key", "");
    expect(wrapper.getItem("key")).toBe("");
  });

  it("handles large values", () => {
    const largeValue = "x".repeat(100_000);
    wrapper.setItem("key", largeValue);
    expect(wrapper.getItem("key")).toBe(largeValue);
  });
});
