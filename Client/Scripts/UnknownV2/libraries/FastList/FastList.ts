/****************************************/
//
//     FastList
//
//  A doubly-linked list with O(1) keyed
//  access via an internal index.
//
/****************************************/

export type SortFn<T> = (a: T, b: T) => number;

export type ForEachCallback<T> = (
  value: T,
  key: string,
  list: LinkedList<T>
) => void;

/** Array-style callback that receives the positional index (head = 0). */
export type MapFn<T, U> = (value: T, index: number, list: LinkedList<T>) => U;

/** Array-style predicate that receives the positional index (head = 0). */
export type Predicate<T> = (value: T, index: number, list: LinkedList<T>) => boolean;

/****************************************/
//
//     List Node
//
/****************************************/

class ListNode<T> {

  value: T;
  next: ListNode<T> | null;
  parent: ListNode<T> | null;
  readonly key: string;

  constructor(value: T, key: string) {
    this.value = value;
    this.next = null;
    this.parent = null;
    this.key = key;
  }

}

/****************************************/
//
//     getUUID
//
/****************************************/

function getUUID(): string {

  let d = Date.now();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

}

/****************************************/
//
//     FastList
//
/****************************************/

export class LinkedList<T = unknown> {

  head: ListNode<T> | null = null;
  tail: ListNode<T> | null = null;
  length = 0;

  private readonly listIndex: Record<string, ListNode<T>> = {};

  private _mustFind(keyAt: string): ListNode<T> {
    const node = this.listIndex[keyAt];
    if (node) return node;
    throw new Error(
      keyAt + ' does not reference an existing node.  Create a node with this key first using an add method'
    );
  }

  private _mustNotFind(keyAt: string): void {
    if (this.listIndex[keyAt]) {
      throw new Error(
        keyAt + ' already refers to an existing node.  Use \'set\' to update an existing node or make sure to pass in a unique key.'
      );
    }
  }

  private _add(val: T, key?: string): ListNode<T> {
    const nodeKey = key || getUUID();
    this._mustNotFind(nodeKey);

    const newNode = new ListNode<T>(val, nodeKey);
    this.listIndex[nodeKey] = newNode;
    this.length++;
    return newNode;
  }

  private _addFirst(val: T, key?: string): string {
    if (this.length) {
      throw new Error('List already has elements.  Use add before/after instead');
    }
    const newNode = this._add(val, key);
    this.head = this.tail = newNode;
    return newNode.key;
  }

  private _placeIn(newNode: ListNode<T>, keyAt: string, placeAbove: boolean): void {
    const nodeAt = this._mustFind(keyAt);

    if (placeAbove) {
      // Insert newNode before nodeAt.
      const above = nodeAt.parent;
      if (above) {
        newNode.parent = above;
        above.next = newNode;
      }
      newNode.next = nodeAt;
      nodeAt.parent = newNode;

      if (nodeAt === this.head) this.head = newNode;
    } else {
      // Insert newNode after nodeAt.
      const below = nodeAt.next;
      if (below) {
        newNode.next = below;
        below.parent = newNode;
      }
      newNode.parent = nodeAt;
      nodeAt.next = newNode;

      if (nodeAt === this.tail) this.tail = newNode;
    }
  }

  addBefore(keyAt: string, val: T, key?: string): string {
    const newNode = this._add(val, key);
    this._placeIn(newNode, keyAt, true);
    return newNode.key;
  }

  addAfter(keyAt: string, val: T, key?: string): string {
    const newNode = this._add(val, key);
    this._placeIn(newNode, keyAt, false);
    return newNode.key;
  }

  addToTail(val: T, key?: string): string {
    if (this.tail) return this.addAfter(this.tail.key, val, key);
    return this._addFirst(val, key);
  }

  addToHead(val: T, key?: string): string {
    if (this.head) return this.addBefore(this.head.key, val, key);
    return this._addFirst(val, key);
  }

  removeAt(keyAt: string): T | undefined {
    const nodeAt = this.listIndex[keyAt];
    if (!nodeAt) return undefined;

    if (nodeAt.parent) nodeAt.parent.next = nodeAt.next;
    else if (this.head === nodeAt) this.head = nodeAt.next;

    if (nodeAt.next) nodeAt.next.parent = nodeAt.parent;
    else if (this.tail === nodeAt) this.tail = nodeAt.parent;

    delete this.listIndex[keyAt];
    this.length--;

    return nodeAt.value;
  }

  removeFromHead(): T | undefined {
    if (this.head) return this.removeAt(this.head.key);
    return undefined;
  }

  removeFromTail(): T | undefined {
    if (this.tail) return this.removeAt(this.tail.key);
    return undefined;
  }

  get(keyAt: string): T | undefined {
    const node = this.listIndex[keyAt];
    if (node) return node.value;
    return undefined;
  }

  first(): T | undefined {
    if (this.head) return this.head.value;
    return undefined;
  }

  last(): T | undefined {
    if (this.tail) return this.tail.value;
    return undefined;
  }

  set(keyAt: string, val: T): void {
    const node = this._mustFind(keyAt);
    node.value = val;
  }

  // Convenience methods

  forEach(cb: ForEachCallback<T>): void {
    for (let node = this.head; node; node = node.next) {
      cb(node.value, node.key, this);
    }
  }

  each(cb: ForEachCallback<T>): void {
    this.forEach(cb);
  }

  sort(sortFn: SortFn<T> = defaultSort): void {
    for (let node = this.head; node; node = node.next) {
      let oldParent = node.parent;

      while (oldParent && sortFn(node.value, oldParent.value) < 0) {

        oldParent.next = node.next;
        node.parent = oldParent.parent;

        if (oldParent === this.head) this.head = node;
        else if (oldParent.parent) oldParent.parent.next = node;

        if (node === this.tail) this.tail = oldParent;
        else if (node.next) node.next.parent = oldParent;

        oldParent.parent = node;
        node.next = oldParent;

        oldParent = node.parent;
      }
    }
  }

  /****************************************/
  //
  //     Array-style API
  //
  //  Positional methods treat the list as
  //  an ordered sequence (head = index 0).
  //  Collection-returning methods yield a
  //  new LinkedList rather than an Array so
  //  results stay chainable; the freshly
  //  created nodes get auto-generated keys.
  //
  /****************************************/

  /** Returns the node at a positional index (supports negatives), or null. */
  private _nodeAt(index: number): ListNode<T> | null {
    let i = index < 0 ? index + this.length : index;
    if (i < 0 || i >= this.length) return null;
    let node = this.head;
    while (node && i > 0) {
      node = node.next;
      i--;
    }
    return node;
  }

  // --- Access ---------------------------------------------------------------

  at(index: number): T | undefined {
    const node = this._nodeAt(index);
    return node ? node.value : undefined;
  }

  indexOf(searchElement: T, fromIndex = 0): number {
    const start = fromIndex < 0 ? Math.max(this.length + fromIndex, 0) : fromIndex;
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      if (i >= start && node.value === searchElement) return i;
    }
    return -1;
  }

  lastIndexOf(searchElement: T, fromIndex?: number): number {
    const len = this.length;
    const start = fromIndex === undefined
      ? len - 1
      : fromIndex < 0 ? len + fromIndex : Math.min(fromIndex, len - 1);
    let i = len - 1;
    for (let node = this.tail; node; node = node.parent, i--) {
      if (i <= start && node.value === searchElement) return i;
    }
    return -1;
  }

  includes(searchElement: T, fromIndex = 0): boolean {
    const start = fromIndex < 0 ? Math.max(this.length + fromIndex, 0) : fromIndex;
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      if (i < start) continue;
      const v = node.value;
      // SameValueZero: NaN equals NaN.
      if (v === searchElement || (v !== v && searchElement !== searchElement)) return true;
    }
    return false;
  }

  // --- Mutation -------------------------------------------------------------

  push(...items: T[]): number {
    for (const item of items) this.addToTail(item);
    return this.length;
  }

  pop(): T | undefined {
    return this.removeFromTail();
  }

  unshift(...items: T[]): number {
    for (let i = items.length - 1; i >= 0; i--) this.addToHead(items[i] as T);
    return this.length;
  }

  shift(): T | undefined {
    return this.removeFromHead();
  }

  reverse(): this {
    let node = this.head;
    while (node) {
      const next = node.next;
      node.next = node.parent;
      node.parent = next;
      node = next;
    }
    const oldHead = this.head;
    this.head = this.tail;
    this.tail = oldHead;
    return this;
  }

  fill(value: T, start = 0, end?: number): this {
    const len = this.length;
    const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
    const e = end === undefined ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
    let i = 0;
    for (let node = this.head; node && i < e; node = node.next, i++) {
      if (i >= s) node.value = value;
    }
    return this;
  }

  copyWithin(target: number, start = 0, end?: number): this {
    const values = [...this.values()];
    values.copyWithin(target, start, end);
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      node.value = values[i] as T;
    }
    return this;
  }

  /** Removes `deleteCount` items at `start` and inserts `items`; returns the removed items. */
  splice(start: number, deleteCount?: number, ...items: T[]): LinkedList<T> {
    const len = this.length;
    const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
    const dc = deleteCount === undefined
      ? len - s
      : Math.min(Math.max(deleteCount, 0), len - s);

    const removed = new LinkedList<T>();
    let anchor = this._nodeAt(s); // node that follows the removed range

    for (let i = 0; i < dc && anchor; i++) {
      const next = anchor.next;
      removed.addToTail(anchor.value);
      this.removeAt(anchor.key);
      anchor = next;
    }

    if (anchor) {
      for (const item of items) this.addBefore(anchor.key, item);
    } else {
      for (const item of items) this.addToTail(item);
    }

    return removed;
  }

  // --- Iteration / reduction ------------------------------------------------

  map<U>(callback: MapFn<T, U>): LinkedList<U> {
    const result = new LinkedList<U>();
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      result.addToTail(callback(node.value, i, this));
    }
    return result;
  }

  filter<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): LinkedList<S>;
  filter(predicate: Predicate<T>): LinkedList<T>;
  filter(predicate: Predicate<T>): LinkedList<T> {
    const result = new LinkedList<T>();
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      if (predicate(node.value, i, this)) result.addToTail(node.value);
    }
    return result;
  }

  find<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): S | undefined;
  find(predicate: Predicate<T>): T | undefined;
  find(predicate: Predicate<T>): T | undefined {
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      if (predicate(node.value, i, this)) return node.value;
    }
    return undefined;
  }

  findIndex(predicate: Predicate<T>): number {
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      if (predicate(node.value, i, this)) return i;
    }
    return -1;
  }

  findLast<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): S | undefined;
  findLast(predicate: Predicate<T>): T | undefined;
  findLast(predicate: Predicate<T>): T | undefined {
    let i = this.length - 1;
    for (let node = this.tail; node; node = node.parent, i--) {
      if (predicate(node.value, i, this)) return node.value;
    }
    return undefined;
  }

  findLastIndex(predicate: Predicate<T>): number {
    let i = this.length - 1;
    for (let node = this.tail; node; node = node.parent, i--) {
      if (predicate(node.value, i, this)) return i;
    }
    return -1;
  }

  every<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): this is LinkedList<S>;
  every(predicate: Predicate<T>): boolean;
  every(predicate: Predicate<T>): boolean {
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      if (!predicate(node.value, i, this)) return false;
    }
    return true;
  }

  some(predicate: Predicate<T>): boolean {
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      if (predicate(node.value, i, this)) return true;
    }
    return false;
  }

  reduce(callback: (acc: T, value: T, index: number, list: LinkedList<T>) => T): T;
  reduce<U>(callback: (acc: U, value: T, index: number, list: LinkedList<T>) => U, initialValue: U): U;
  reduce(callback: (acc: any, value: T, index: number, list: LinkedList<T>) => any, initialValue?: any): any {
    let acc = initialValue;
    let node = this.head;
    let index = 0;
    if (arguments.length < 2) {
      if (!node) throw new TypeError('Reduce of empty list with no initial value');
      acc = node.value;
      node = node.next;
      index = 1;
    }
    for (; node; node = node.next, index++) {
      acc = callback(acc, node.value, index, this);
    }
    return acc;
  }

  reduceRight(callback: (acc: T, value: T, index: number, list: LinkedList<T>) => T): T;
  reduceRight<U>(callback: (acc: U, value: T, index: number, list: LinkedList<T>) => U, initialValue: U): U;
  reduceRight(callback: (acc: any, value: T, index: number, list: LinkedList<T>) => any, initialValue?: any): any {
    let acc = initialValue;
    let node = this.tail;
    let index = this.length - 1;
    if (arguments.length < 2) {
      if (!node) throw new TypeError('Reduce of empty list with no initial value');
      acc = node.value;
      node = node.parent;
      index--;
    }
    for (; node; node = node.parent, index--) {
      acc = callback(acc, node.value, index, this);
    }
    return acc;
  }

  // --- Copying / slicing ----------------------------------------------------

  slice(start = 0, end?: number): LinkedList<T> {
    const len = this.length;
    const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
    const e = end === undefined ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
    const result = new LinkedList<T>();
    let i = 0;
    for (let node = this.head; node && i < e; node = node.next, i++) {
      if (i >= s) result.addToTail(node.value);
    }
    return result;
  }

  /** Materializes the list into a native array, head first. */
  ToList(): T[] {
    return [...this.values()];
  }

  concat(...items: Array<T | LinkedList<T> | ReadonlyArray<T>>): LinkedList<T> {
    const result = this.slice();
    for (const item of items) {
      if (item instanceof LinkedList) {
        for (let node = item.head; node; node = node.next) result.addToTail(node.value);
      } else if (Array.isArray(item)) {
        for (const v of item) result.addToTail(v);
      } else {
        result.addToTail(item as T);
      }
    }
    return result;
  }

  flatMap<U>(
    callback: (value: T, index: number, list: LinkedList<T>) => U | ReadonlyArray<U> | LinkedList<U>
  ): LinkedList<U> {
    const result = new LinkedList<U>();
    let i = 0;
    for (let node = this.head; node; node = node.next, i++) {
      const mapped = callback(node.value, i, this);
      if (mapped instanceof LinkedList) {
        for (let n = mapped.head; n; n = n.next) result.addToTail(n.value);
      } else if (Array.isArray(mapped)) {
        for (const v of mapped) result.addToTail(v);
      } else {
        result.addToTail(mapped as U);
      }
    }
    return result;
  }

  flat(depth = 1): LinkedList<unknown> {
    const result = new LinkedList<unknown>();
    const addFlattened = (value: unknown, d: number): void => {
      if (d > 0 && (value instanceof LinkedList || Array.isArray(value))) {
        const inner: Iterable<unknown> = value instanceof LinkedList ? value.values() : value;
        for (const v of inner) addFlattened(v, d - 1);
      } else {
        result.addToTail(value);
      }
    };
    for (let node = this.head; node; node = node.next) addFlattened(node.value, depth);
    return result;
  }

  // --- Immutable (ES2023) variants ------------------------------------------

  with(index: number, value: T): LinkedList<T> {
    const len = this.length;
    const i = index < 0 ? len + index : index;
    if (i < 0 || i >= len) throw new RangeError('Invalid index : ' + index);
    const result = new LinkedList<T>();
    let idx = 0;
    for (let node = this.head; node; node = node.next, idx++) {
      result.addToTail(idx === i ? value : node.value);
    }
    return result;
  }

  toReversed(): LinkedList<T> {
    const copy = this.slice();
    copy.reverse();
    return copy;
  }

  toSorted(compareFn?: SortFn<T>): LinkedList<T> {
    const copy = this.slice();
    if (compareFn) copy.sort(compareFn);
    else copy.sort();
    return copy;
  }

  toSpliced(start: number, deleteCount?: number, ...items: T[]): LinkedList<T> {
    const copy = this.slice();
    if (deleteCount === undefined) copy.splice(start);
    else copy.splice(start, deleteCount, ...items);
    return copy;
  }

  // --- Stringification ------------------------------------------------------

  join(separator = ','): string {
    let result = '';
    let first = true;
    for (let node = this.head; node; node = node.next) {
      const v = node.value;
      const s = v === null || v === undefined ? '' : String(v);
      result = first ? s : result + separator + s;
      first = false;
    }
    return result;
  }

  toString(): string {
    return this.join();
  }

  toLocaleString(): string {
    let result = '';
    let first = true;
    for (let node = this.head; node; node = node.next) {
      const v = node.value;
      const s = v === null || v === undefined
        ? ''
        : (v as { toLocaleString(): string }).toLocaleString();
      result = first ? s : result + ',' + s;
      first = false;
    }
    return result;
  }

  // --- Iterators ------------------------------------------------------------

  *values(): IterableIterator<T> {
    for (let node = this.head; node; node = node.next) yield node.value;
  }

  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.length; i++) yield i;
  }

  *entries(): IterableIterator<[number, T]> {
    let i = 0;
    for (let node = this.head; node; node = node.next) yield [i++, node.value];
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.values();
  }

  // --- Static constructors --------------------------------------------------

  static isLinkedList(value: unknown): value is LinkedList<unknown> {
    return value instanceof LinkedList;
  }

  static of<V>(...items: V[]): LinkedList<V> {
    const list = new LinkedList<V>();
    for (const item of items) list.addToTail(item);
    return list;
  }

  static from<V>(iterable: Iterable<V> | ArrayLike<V>): LinkedList<V>;
  static from<V, U>(iterable: Iterable<V> | ArrayLike<V>, mapFn: (value: V, index: number) => U): LinkedList<U>;
  static from(iterable: any, mapFn?: (value: any, index: number) => any): LinkedList<any> {
    const list = new LinkedList<any>();
    if (iterable != null && typeof iterable[Symbol.iterator] === 'function') {
      let i = 0;
      for (const v of iterable as Iterable<any>) {
        list.addToTail(mapFn ? mapFn(v, i) : v);
        i++;
      }
    } else {
      const arrayLike = iterable as ArrayLike<any>;
      for (let i = 0; i < arrayLike.length; i++) {
        const v = arrayLike[i];
        list.addToTail(mapFn ? mapFn(v, i) : v);
      }
    }
    return list;
  }

}

function defaultSort<T>(a: T, b: T): number {
  const aStr = a === null ? 'null' : String(a);
  const bStr = b === null ? 'null' : String(b);
  return aStr < bStr ? -1 : 1;
}
