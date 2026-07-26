import { describe, it, expect } from "vitest";
import { LinkedList } from "../../libraries/FastList/FastList.ts";

describe("construction", () => {
  it("from(array)", () => expect([...LinkedList.from([3, 1, 2])]).toEqual([3, 1, 2]));
  it("of", () => expect([...LinkedList.of(1, 2, 3)]).toEqual([1, 2, 3]));
  it("from(iterable string)", () => expect([...LinkedList.from("ab")]).toEqual(["a", "b"]));
  it("from(array-like)", () => expect([...LinkedList.from({ length: 2, 0: "x", 1: "y" })]).toEqual(["x", "y"]));
  it("from with mapFn", () => expect([...LinkedList.from([1, 2], (n) => n * 10)]).toEqual([10, 20]));
  it("isLinkedList(true)", () => expect(LinkedList.isLinkedList(new LinkedList())).toBe(true));
  it("isLinkedList(false)", () => expect(LinkedList.isLinkedList([])).toBe(false));
});

describe("access", () => {
  const l = () => LinkedList.from([10, 20, 30]);

  it("at(0)", () => expect(l().at(0)).toBe(10));
  it("at(-1)", () => expect(l().at(-1)).toBe(30));
  it("at(out of range)", () => expect(l().at(5)).toBe(undefined));
  it("indexOf", () => expect(l().indexOf(20)).toBe(1));
  it("indexOf(missing)", () => expect(l().indexOf(999)).toBe(-1));
  it("lastIndexOf", () => expect(l().lastIndexOf(20)).toBe(1));
  it("includes", () => expect(l().includes(30)).toBe(true));
  it("includes(missing)", () => expect(l().includes(999)).toBe(false));
  it("includes(NaN) SameValueZero", () => expect(LinkedList.of(NaN).includes(NaN)).toBe(true));
  it("indexOf(NaN) strict equality", () => expect(LinkedList.of(NaN).indexOf(NaN)).toBe(-1));
});

describe("transformation", () => {
  const l = () => LinkedList.from([10, 20, 30]);

  it("map", () => expect([...l().map((n) => n / 10)]).toEqual([1, 2, 3]));
  it("filter", () => expect([...l().filter((n) => n > 15)]).toEqual([20, 30]));
  it("reduce (no init)", () => expect(l().reduce((a, b) => a + b)).toBe(60));
  it("reduce (with init)", () => expect(l().reduce((a, b) => a + b, 100)).toBe(160));
  it("reduceRight", () => expect(l().reduceRight((a, b) => a + "," + b, "")).toBe(",30,20,10"));
  it("find", () => expect(l().find((n) => n > 15)).toBe(20));
  it("findIndex", () => expect(l().findIndex((n) => n > 15)).toBe(1));
  it("findLast", () => expect(l().findLast((n) => n > 15)).toBe(30));
  it("findLastIndex", () => expect(l().findLastIndex((n) => n > 15)).toBe(2));
  it("every(true)", () => expect(l().every((n) => n > 0)).toBe(true));
  it("every(false)", () => expect(l().every((n) => n > 15)).toBe(false));
  it("some(true)", () => expect(l().some((n) => n > 25)).toBe(true));
  it("some(false)", () => expect(l().some((n) => n > 99)).toBe(false));
  it("flat", () => expect([...LinkedList.from<unknown>([1, [2, 3], LinkedList.of(4, 5)]).flat()]).toEqual([1, 2, 3, 4, 5]));
  it("flatMap", () => expect([...LinkedList.of(1, 2).flatMap((n) => [n, n])]).toEqual([1, 1, 2, 2]));
  it("concat", () => expect([...LinkedList.of(1).concat(2, [3, 4], LinkedList.of(5))]).toEqual([1, 2, 3, 4, 5]));
});

describe("conversion", () => {
  it("ToList returns a native array", () => expect(Array.isArray(LinkedList.of(1, 2, 3).ToList())).toBe(true));
  it("ToList preserves order", () => expect(LinkedList.of(1, 2, 3).ToList().join(",")).toBe("1,2,3"));
  it("ToList on empty list", () => expect(new LinkedList<number>().ToList().length).toBe(0));
});

describe("mutation", () => {
  // These sequences are order-dependent -- each operation builds on the previous
  // result -- so a sequence stays inside one test rather than split across siblings.
  it("push / pop", () => {
    const m = LinkedList.from([1, 2, 3]);
    expect(m.push(4, 5)).toBe(5);                 // push returns length
    expect([...m]).toEqual([1, 2, 3, 4, 5]);      // push appends
    expect(m.pop()).toBe(5);                      // pop returns value
  });

  it("unshift / shift", () => {
    const m = LinkedList.from([1, 2, 3, 4]);
    expect(m.unshift(-1, 0)).toBe(6);             // unshift returns length
    expect([...m]).toEqual([-1, 0, 1, 2, 3, 4]);  // unshift prepends in order
    expect(m.shift()).toBe(-1);                   // shift returns value
  });

  it("reverse in place", () => expect([...LinkedList.from([0, 1, 2, 3, 4]).reverse()]).toEqual([4, 3, 2, 1, 0]));
  it("fill(value, start, end)", () => expect([...LinkedList.from([4, 3, 2, 1, 0]).fill(7, 1, 3)]).toEqual([4, 7, 7, 1, 0]));
  it("copyWithin", () => expect([...LinkedList.from([1, 2, 3, 4, 5]).copyWithin(0, 3)]).toEqual([4, 5, 3, 4, 5]));

  it("splice returns removed and mutates", () => {
    const sp = LinkedList.of("a", "b", "c", "d");
    expect([...sp.splice(1, 2, "X", "Y", "Z")]).toEqual(["b", "c"]);
    expect([...sp]).toEqual(["a", "X", "Y", "Z", "d"]);
  });

  it("splice(start) removes rest", () => expect([...LinkedList.of(1, 2, 3).splice(1)]).toEqual([2, 3]));
});

describe("slicing / immutable variants", () => {
  it("slice(start, end)", () => expect([...LinkedList.of(0, 1, 2, 3, 4).slice(1, 3)]).toEqual([1, 2]));
  it("slice(negative)", () => expect([...LinkedList.of(0, 1, 2, 3, 4).slice(-2)]).toEqual([3, 4]));
  it("with", () => expect([...LinkedList.of(1, 2, 3).with(1, 99)]).toEqual([1, 99, 3]));
  it("toReversed", () => expect([...LinkedList.of(1, 2, 3).toReversed()]).toEqual([3, 2, 1]));
  it("toSorted", () => expect([...LinkedList.of(3, 1, 2).toSorted((a, b) => a - b)]).toEqual([1, 2, 3]));
  it("toSpliced", () => expect([...LinkedList.of(1, 2, 3, 4).toSpliced(1, 2, 9)]).toEqual([1, 9, 4]));

  it("immutable variants do not mutate source", () => {
    const src = LinkedList.of(1, 2, 3);
    src.with(0, 99);
    src.toReversed();
    expect([...src]).toEqual([1, 2, 3]);
  });
});

describe("stringification", () => {
  it("join", () => expect(LinkedList.of(1, 2, 3).join("-")).toBe("1-2-3"));
  it("join(null -> empty)", () => expect(LinkedList.of(1, null, 3).join()).toBe("1,,3"));
  it("toString", () => expect(LinkedList.of("a", "b").toString()).toBe("a,b"));
});

describe("iteration", () => {
  it("keys yields indices", () => expect([...LinkedList.of("a", "b").keys()].join(",")).toBe("0,1"));
  it("values", () => expect([...LinkedList.of("a", "b").values()].join(",")).toBe("a,b"));
  it("entries", () => expect(JSON.stringify([...LinkedList.of("a", "b").entries()])).toBe('[[0,"a"],[1,"b"]]'));
  it("Symbol.iterator / spread", () => expect([...LinkedList.of(1, 2, 3)].join(",")).toBe("1,2,3"));
});

describe("preserved keyed API", () => {
  it("addToTail returns key, get and set by key", () => {
    const keyed = new LinkedList<string>();
    expect(keyed.addToTail("hello", "greeting")).toBe("greeting");
    expect(keyed.get("greeting")).toBe("hello");
    keyed.set("greeting", "hi");
    expect(keyed.get("greeting")).toBe("hi");
  });
});
