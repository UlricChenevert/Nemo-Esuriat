import { describe, it, expect } from "vitest";
import { InMemoryKeyValueStore } from "../../Libraries/Storage/InMemoryKeyValueStore.ts";
import { CreateDefaultKeyValueStore } from "../../Libraries/Storage/CreateDefaultKeyValueStore.ts";

describe("InMemoryKeyValueStore", () => {
  it("round-trips a value", () => {
    const store = new InMemoryKeyValueStore();
    store.SetItem("world", "data");

    expect(store.GetItem("world")).toBe("data");
  });

  it("returns null for a missing key", () => expect(new InMemoryKeyValueStore().GetItem("absent")).toBe(null));

  it("overwrites an existing key", () => {
    const store = new InMemoryKeyValueStore();
    store.SetItem("world", "first");
    store.SetItem("world", "second");

    expect(store.GetItem("world")).toBe("second");
  });

  it("removes a key", () => {
    const store = new InMemoryKeyValueStore();
    store.SetItem("world", "data");
    store.RemoveItem("world");

    expect(store.GetItem("world")).toBe(null);
  });

  it("removing an absent key does not throw", () => expect(() => new InMemoryKeyValueStore().RemoveItem("absent")).not.toThrow());
  it("stores an empty string as a value, not as absence", () => {
    const store = new InMemoryKeyValueStore();
    store.SetItem("world", "");

    expect(store.GetItem("world")).toBe("");
  });

  it("keeps keys independent", () => {
    const store = new InMemoryKeyValueStore();
    store.SetItem("a", "1");
    store.SetItem("b", "2");
    store.RemoveItem("a");

    expect(store.GetItem("b")).toBe("2");
  });
});

describe("CreateDefaultKeyValueStore", () => {
  // The point of the factory: constructing storage must never throw just
  // because the runtime has no DOM.
  it("returns a usable store without a DOM", () => {
    const store = CreateDefaultKeyValueStore();
    store.SetItem("world", "data");

    expect(store.GetItem("world")).toBe("data");
  });
});
