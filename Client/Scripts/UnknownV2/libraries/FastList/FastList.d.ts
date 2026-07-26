/****************************************/
/****************************************/
export type SortFn<T> = (a: T, b: T) => number;
export type ForEachCallback<T> = (value: T, key: string, list: LinkedList<T>) => void;
/** Array-style callback that receives the positional index (head = 0). */
export type MapFn<T, U> = (value: T, index: number, list: LinkedList<T>) => U;
/** Array-style predicate that receives the positional index (head = 0). */
export type Predicate<T> = (value: T, index: number, list: LinkedList<T>) => boolean;
/****************************************/
/****************************************/
declare class ListNode<T> {
    value: T;
    next: ListNode<T> | null;
    parent: ListNode<T> | null;
    readonly key: string;
    constructor(value: T, key: string);
}
/****************************************/
/****************************************/
export declare class LinkedList<T = unknown> {
    head: ListNode<T> | null;
    tail: ListNode<T> | null;
    length: number;
    private readonly listIndex;
    private _mustFind;
    private _mustNotFind;
    private _add;
    private _addFirst;
    private _placeIn;
    addBefore(keyAt: string, val: T, key?: string): string;
    addAfter(keyAt: string, val: T, key?: string): string;
    addToTail(val: T, key?: string): string;
    addToHead(val: T, key?: string): string;
    removeAt(keyAt: string): T | undefined;
    removeFromHead(): T | undefined;
    removeFromTail(): T | undefined;
    get(keyAt: string): T | undefined;
    first(): T | undefined;
    last(): T | undefined;
    set(keyAt: string, val: T): void;
    forEach(cb: ForEachCallback<T>): void;
    each(cb: ForEachCallback<T>): void;
    sort(sortFn?: SortFn<T>): void;
    /****************************************/
    /****************************************/
    /** Returns the node at a positional index (supports negatives), or null. */
    private _nodeAt;
    at(index: number): T | undefined;
    indexOf(searchElement: T, fromIndex?: number): number;
    lastIndexOf(searchElement: T, fromIndex?: number): number;
    includes(searchElement: T, fromIndex?: number): boolean;
    push(...items: T[]): number;
    pop(): T | undefined;
    unshift(...items: T[]): number;
    shift(): T | undefined;
    reverse(): this;
    fill(value: T, start?: number, end?: number): this;
    copyWithin(target: number, start?: number, end?: number): this;
    /** Removes `deleteCount` items at `start` and inserts `items`; returns the removed items. */
    splice(start: number, deleteCount?: number, ...items: T[]): LinkedList<T>;
    map<U>(callback: MapFn<T, U>): LinkedList<U>;
    filter<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): LinkedList<S>;
    filter(predicate: Predicate<T>): LinkedList<T>;
    find<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): S | undefined;
    find(predicate: Predicate<T>): T | undefined;
    findIndex(predicate: Predicate<T>): number;
    findLast<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): S | undefined;
    findLast(predicate: Predicate<T>): T | undefined;
    findLastIndex(predicate: Predicate<T>): number;
    every<S extends T>(predicate: (value: T, index: number, list: LinkedList<T>) => value is S): this is LinkedList<S>;
    every(predicate: Predicate<T>): boolean;
    some(predicate: Predicate<T>): boolean;
    reduce(callback: (acc: T, value: T, index: number, list: LinkedList<T>) => T): T;
    reduce<U>(callback: (acc: U, value: T, index: number, list: LinkedList<T>) => U, initialValue: U): U;
    reduceRight(callback: (acc: T, value: T, index: number, list: LinkedList<T>) => T): T;
    reduceRight<U>(callback: (acc: U, value: T, index: number, list: LinkedList<T>) => U, initialValue: U): U;
    slice(start?: number, end?: number): LinkedList<T>;
    /** Materializes the list into a native array, head first. */
    ToList(): T[];
    concat(...items: Array<T | LinkedList<T> | ReadonlyArray<T>>): LinkedList<T>;
    flatMap<U>(callback: (value: T, index: number, list: LinkedList<T>) => U | ReadonlyArray<U> | LinkedList<U>): LinkedList<U>;
    flat(depth?: number): LinkedList<unknown>;
    with(index: number, value: T): LinkedList<T>;
    toReversed(): LinkedList<T>;
    toSorted(compareFn?: SortFn<T>): LinkedList<T>;
    toSpliced(start: number, deleteCount?: number, ...items: T[]): LinkedList<T>;
    join(separator?: string): string;
    toString(): string;
    toLocaleString(): string;
    values(): IterableIterator<T>;
    keys(): IterableIterator<number>;
    entries(): IterableIterator<[number, T]>;
    [Symbol.iterator](): IterableIterator<T>;
    static isLinkedList(value: unknown): value is LinkedList<unknown>;
    static of<V>(...items: V[]): LinkedList<V>;
    static from<V>(iterable: Iterable<V> | ArrayLike<V>): LinkedList<V>;
    static from<V, U>(iterable: Iterable<V> | ArrayLike<V>, mapFn: (value: V, index: number) => U): LinkedList<U>;
}
export {};
//# sourceMappingURL=FastList.d.ts.map