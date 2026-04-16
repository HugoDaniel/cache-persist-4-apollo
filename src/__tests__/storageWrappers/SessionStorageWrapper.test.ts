import { describe, it, expect, beforeEach } from "vitest";
import { SessionStorageWrapper } from "../../storageWrappers/SessionStorageWrapper.js";

describe("SessionStorageWrapper", () => {
  let wrapper: SessionStorageWrapper;

  beforeEach(() => {
    sessionStorage.clear();
    wrapper = new SessionStorageWrapper(sessionStorage);
  });

  it("getItem returns null when key does not exist", () => {
    expect(wrapper.getItem("nonexistent")).toBeNull();
  });

  it("setItem stores a value", () => {
    wrapper.setItem("key", "value");
    expect(sessionStorage.getItem("key")).toBe("value");
  });

  it("getItem retrieves a stored value", () => {
    sessionStorage.setItem("key", "value");
    expect(wrapper.getItem("key")).toBe("value");
  });

  it("removeItem removes a stored value", () => {
    sessionStorage.setItem("key", "value");
    wrapper.removeItem("key");
    expect(sessionStorage.getItem("key")).toBeNull();
  });

  it("handles empty string values", () => {
    wrapper.setItem("key", "");
    expect(wrapper.getItem("key")).toBe("");
  });

  it("throws if storage is not writable", () => {
    const readOnlyStorage = {
      length: 0,
      key: () => null,
      getItem: () => null,
      setItem: () => {
        throw new DOMException("not allowed", "SecurityError");
      },
      removeItem: () => {},
      clear: () => {},
    } as Storage;

    expect(() => new SessionStorageWrapper(readOnlyStorage)).toThrow(
      "not writable",
    );
  });
});
