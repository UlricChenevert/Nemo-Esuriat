import { LinkedList } from "../../libraries/FastList/FastList";

// The project compiles with `types: []` and no DOM lib, so `console` is not
// declared globally. Declare the slice this harness needs.
declare const console: {
  log(...data: unknown[]): void;
  error(...data: unknown[]): void;
};

/****************************************/
//
//     Minimal assert harness
//
//  No test runner is configured yet, so
//  this file is self-contained: it counts
//  passes/failures and throws at the end
//  if anything failed (non-zero exit).
//
/****************************************/

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error("  FAIL: " + message);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  assert(Object.is(actual, expected), message + " (expected " + String(expected) + ", got " + String(actual) + ")");
}

function assertList<T>(list: LinkedList<T>, expected: T[], message: string): void {
  const actual = [...list];
  const same = actual.length === expected.length && actual.every((v, i) => Object.is(v, expected[i]));
  assert(same, message + " (expected [" + expected.join(",") + "], got [" + actual.join(",") + "])");
}

/****************************************/
//
//     Tests
//
/****************************************/

export function runFastListTests(): void {

  // --- construction ---
  assertList(LinkedList.from([3, 1, 2]), [3, 1, 2], "from(array)");
  assertList(LinkedList.of(1, 2, 3), [1, 2, 3], "of");
  assertList(LinkedList.from("ab"), ["a", "b"], "from(iterable string)");
  assertList(LinkedList.from({ length: 2, 0: "x", 1: "y" }), ["x", "y"], "from(array-like)");
  assertList(LinkedList.from([1, 2], (n) => n * 10), [10, 20], "from with mapFn");
  assert(LinkedList.isLinkedList(new LinkedList()), "isLinkedList(true)");
  assert(!LinkedList.isLinkedList([]), "isLinkedList(false)");

  // --- access ---
  const l = LinkedList.from([10, 20, 30]);
  assertEqual(l.at(0), 10, "at(0)");
  assertEqual(l.at(-1), 30, "at(-1)");
  assertEqual(l.at(5), undefined, "at(out of range)");
  assertEqual(l.indexOf(20), 1, "indexOf");
  assertEqual(l.indexOf(999), -1, "indexOf(missing)");
  assertEqual(l.lastIndexOf(20), 1, "lastIndexOf");
  assert(l.includes(30), "includes");
  assert(!l.includes(999), "includes(missing)");
  assert(LinkedList.of(NaN).includes(NaN), "includes(NaN) SameValueZero");
  assertEqual(LinkedList.of(NaN).indexOf(NaN), -1, "indexOf(NaN) strict equality");

  // --- transformation ---
  assertList(l.map((n) => n / 10), [1, 2, 3], "map");
  assertList(l.filter((n) => n > 15), [20, 30], "filter");
  assertEqual(l.reduce((a, b) => a + b), 60, "reduce (no init)");
  assertEqual(l.reduce((a, b) => a + b, 100), 160, "reduce (with init)");
  assertEqual(l.reduceRight((a, b) => a + "," + b, ""), ",30,20,10", "reduceRight");
  assertEqual(l.find((n) => n > 15), 20, "find");
  assertEqual(l.findIndex((n) => n > 15), 1, "findIndex");
  assertEqual(l.findLast((n) => n > 15), 30, "findLast");
  assertEqual(l.findLastIndex((n) => n > 15), 2, "findLastIndex");
  assert(l.every((n) => n > 0), "every(true)");
  assert(!l.every((n) => n > 15), "every(false)");
  assert(l.some((n) => n > 25), "some(true)");
  assert(!l.some((n) => n > 99), "some(false)");
  assertList(LinkedList.from<unknown>([1, [2, 3], LinkedList.of(4, 5)]).flat(), [1, 2, 3, 4, 5], "flat");
  assertList(LinkedList.of(1, 2).flatMap((n) => [n, n]), [1, 1, 2, 2], "flatMap");
  assertList(LinkedList.of(1).concat(2, [3, 4], LinkedList.of(5)), [1, 2, 3, 4, 5], "concat");

  // --- conversion ---
  const toList = LinkedList.of(1, 2, 3).ToList();
  assert(Array.isArray(toList), "ToList returns a native array");
  assertEqual(toList.join(","), "1,2,3", "ToList preserves order");
  assertEqual(new LinkedList<number>().ToList().length, 0, "ToList on empty list");

  // --- mutation ---
  const m = LinkedList.from([1, 2, 3]);
  assertEqual(m.push(4, 5), 5, "push returns length");
  assertList(m, [1, 2, 3, 4, 5], "push appends");
  assertEqual(m.pop(), 5, "pop returns value");
  assertEqual(m.unshift(-1, 0), 6, "unshift returns length");
  assertList(m, [-1, 0, 1, 2, 3, 4], "unshift prepends in order");
  assertEqual(m.shift(), -1, "shift returns value");
  assertList(m.reverse(), [4, 3, 2, 1, 0], "reverse in place");
  assertList(m.fill(7, 1, 3), [4, 7, 7, 1, 0], "fill(value, start, end)");
  assertList(LinkedList.from([1, 2, 3, 4, 5]).copyWithin(0, 3), [4, 5, 3, 4, 5], "copyWithin");

  const sp = LinkedList.of("a", "b", "c", "d");
  const removed = sp.splice(1, 2, "X", "Y", "Z");
  assertList(removed, ["b", "c"], "splice returns removed");
  assertList(sp, ["a", "X", "Y", "Z", "d"], "splice mutates");
  assertList(LinkedList.of(1, 2, 3).splice(1), [2, 3], "splice(start) removes rest");

  // --- slicing / immutable variants ---
  assertList(LinkedList.of(0, 1, 2, 3, 4).slice(1, 3), [1, 2], "slice(start, end)");
  assertList(LinkedList.of(0, 1, 2, 3, 4).slice(-2), [3, 4], "slice(negative)");
  assertList(LinkedList.of(1, 2, 3).with(1, 99), [1, 99, 3], "with");
  assertList(LinkedList.of(1, 2, 3).toReversed(), [3, 2, 1], "toReversed");
  assertList(LinkedList.of(3, 1, 2).toSorted((a, b) => a - b), [1, 2, 3], "toSorted");
  assertList(LinkedList.of(1, 2, 3, 4).toSpliced(1, 2, 9), [1, 9, 4], "toSpliced");

  // immutable variants leave the source untouched
  const src = LinkedList.of(1, 2, 3);
  src.with(0, 99);
  src.toReversed();
  assertList(src, [1, 2, 3], "immutable variants do not mutate source");

  // --- stringification ---
  assertEqual(LinkedList.of(1, 2, 3).join("-"), "1-2-3", "join");
  assertEqual(LinkedList.of(1, null, 3).join(), "1,,3", "join(null -> empty)");
  assertEqual(LinkedList.of("a", "b").toString(), "a,b", "toString");

  // --- iteration ---
  assertEqual([...LinkedList.of("a", "b").keys()].join(","), "0,1", "keys yields indices");
  assertEqual([...LinkedList.of("a", "b").values()].join(","), "a,b", "values");
  assertEqual(JSON.stringify([...LinkedList.of("a", "b").entries()]), '[[0,"a"],[1,"b"]]', "entries");
  assertEqual([...LinkedList.of(1, 2, 3)].join(","), "1,2,3", "Symbol.iterator / spread");

  // --- preserved keyed API still works ---
  const keyed = new LinkedList<string>();
  const k = keyed.addToTail("hello", "greeting");
  assertEqual(k, "greeting", "addToTail returns key");
  assertEqual(keyed.get("greeting"), "hello", "get by key");
  keyed.set("greeting", "hi");
  assertEqual(keyed.get("greeting"), "hi", "set by key");

  console.log(`\nFastList: ${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error(`${failed} FastList test(s) failed`);
}

runFastListTests();
