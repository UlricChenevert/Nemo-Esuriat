/****************************************/
//
//     FastList
//
//  A doubly-linked list with O(1) keyed
//  access via an internal index.
//
/****************************************/
/****************************************/
//
//     List Node
//
/****************************************/
class ListNode {
    value;
    next;
    parent;
    key;
    constructor(value, key) {
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
function getUUID() {
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
export class LinkedList {
    head = null;
    tail = null;
    length = 0;
    listIndex = {};
    _mustFind(keyAt) {
        const node = this.listIndex[keyAt];
        if (node)
            return node;
        throw new Error(keyAt + ' does not reference an existing node.  Create a node with this key first using an add method');
    }
    _mustNotFind(keyAt) {
        if (this.listIndex[keyAt]) {
            throw new Error(keyAt + ' already refers to an existing node.  Use \'set\' to update an existing node or make sure to pass in a unique key.');
        }
    }
    _add(val, key) {
        const nodeKey = key || getUUID();
        this._mustNotFind(nodeKey);
        const newNode = new ListNode(val, nodeKey);
        this.listIndex[nodeKey] = newNode;
        this.length++;
        return newNode;
    }
    _addFirst(val, key) {
        if (this.length) {
            throw new Error('List already has elements.  Use add before/after instead');
        }
        const newNode = this._add(val, key);
        this.head = this.tail = newNode;
        return newNode.key;
    }
    _placeIn(newNode, keyAt, placeAbove) {
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
            if (nodeAt === this.head)
                this.head = newNode;
        }
        else {
            // Insert newNode after nodeAt.
            const below = nodeAt.next;
            if (below) {
                newNode.next = below;
                below.parent = newNode;
            }
            newNode.parent = nodeAt;
            nodeAt.next = newNode;
            if (nodeAt === this.tail)
                this.tail = newNode;
        }
    }
    addBefore(keyAt, val, key) {
        const newNode = this._add(val, key);
        this._placeIn(newNode, keyAt, true);
        return newNode.key;
    }
    addAfter(keyAt, val, key) {
        const newNode = this._add(val, key);
        this._placeIn(newNode, keyAt, false);
        return newNode.key;
    }
    addToTail(val, key) {
        if (this.tail)
            return this.addAfter(this.tail.key, val, key);
        return this._addFirst(val, key);
    }
    addToHead(val, key) {
        if (this.head)
            return this.addBefore(this.head.key, val, key);
        return this._addFirst(val, key);
    }
    removeAt(keyAt) {
        const nodeAt = this.listIndex[keyAt];
        if (!nodeAt)
            return undefined;
        if (nodeAt.parent)
            nodeAt.parent.next = nodeAt.next;
        else if (this.head === nodeAt)
            this.head = nodeAt.next;
        if (nodeAt.next)
            nodeAt.next.parent = nodeAt.parent;
        else if (this.tail === nodeAt)
            this.tail = nodeAt.parent;
        delete this.listIndex[keyAt];
        this.length--;
        return nodeAt.value;
    }
    removeFromHead() {
        if (this.head)
            return this.removeAt(this.head.key);
        return undefined;
    }
    removeFromTail() {
        if (this.tail)
            return this.removeAt(this.tail.key);
        return undefined;
    }
    get(keyAt) {
        const node = this.listIndex[keyAt];
        if (node)
            return node.value;
        return undefined;
    }
    first() {
        if (this.head)
            return this.head.value;
        return undefined;
    }
    last() {
        if (this.tail)
            return this.tail.value;
        return undefined;
    }
    set(keyAt, val) {
        const node = this._mustFind(keyAt);
        node.value = val;
    }
    // Convenience methods
    forEach(cb) {
        for (let node = this.head; node; node = node.next) {
            cb(node.value, node.key, this);
        }
    }
    each(cb) {
        this.forEach(cb);
    }
    sort(sortFn = defaultSort) {
        for (let node = this.head; node; node = node.next) {
            let oldParent = node.parent;
            while (oldParent && sortFn(node.value, oldParent.value) < 0) {
                oldParent.next = node.next;
                node.parent = oldParent.parent;
                if (oldParent === this.head)
                    this.head = node;
                else if (oldParent.parent)
                    oldParent.parent.next = node;
                if (node === this.tail)
                    this.tail = oldParent;
                else if (node.next)
                    node.next.parent = oldParent;
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
    _nodeAt(index) {
        let i = index < 0 ? index + this.length : index;
        if (i < 0 || i >= this.length)
            return null;
        let node = this.head;
        while (node && i > 0) {
            node = node.next;
            i--;
        }
        return node;
    }
    // --- Access ---------------------------------------------------------------
    at(index) {
        const node = this._nodeAt(index);
        return node ? node.value : undefined;
    }
    indexOf(searchElement, fromIndex = 0) {
        const start = fromIndex < 0 ? Math.max(this.length + fromIndex, 0) : fromIndex;
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            if (i >= start && node.value === searchElement)
                return i;
        }
        return -1;
    }
    lastIndexOf(searchElement, fromIndex) {
        const len = this.length;
        const start = fromIndex === undefined
            ? len - 1
            : fromIndex < 0 ? len + fromIndex : Math.min(fromIndex, len - 1);
        let i = len - 1;
        for (let node = this.tail; node; node = node.parent, i--) {
            if (i <= start && node.value === searchElement)
                return i;
        }
        return -1;
    }
    includes(searchElement, fromIndex = 0) {
        const start = fromIndex < 0 ? Math.max(this.length + fromIndex, 0) : fromIndex;
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            if (i < start)
                continue;
            const v = node.value;
            // SameValueZero: NaN equals NaN.
            if (v === searchElement || (v !== v && searchElement !== searchElement))
                return true;
        }
        return false;
    }
    // --- Mutation -------------------------------------------------------------
    push(...items) {
        for (const item of items)
            this.addToTail(item);
        return this.length;
    }
    pop() {
        return this.removeFromTail();
    }
    unshift(...items) {
        for (let i = items.length - 1; i >= 0; i--)
            this.addToHead(items[i]);
        return this.length;
    }
    shift() {
        return this.removeFromHead();
    }
    reverse() {
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
    fill(value, start = 0, end) {
        const len = this.length;
        const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
        const e = end === undefined ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
        let i = 0;
        for (let node = this.head; node && i < e; node = node.next, i++) {
            if (i >= s)
                node.value = value;
        }
        return this;
    }
    copyWithin(target, start = 0, end) {
        const values = [...this.values()];
        values.copyWithin(target, start, end);
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            node.value = values[i];
        }
        return this;
    }
    /** Removes `deleteCount` items at `start` and inserts `items`; returns the removed items. */
    splice(start, deleteCount, ...items) {
        const len = this.length;
        const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
        const dc = deleteCount === undefined
            ? len - s
            : Math.min(Math.max(deleteCount, 0), len - s);
        const removed = new LinkedList();
        let anchor = this._nodeAt(s); // node that follows the removed range
        for (let i = 0; i < dc && anchor; i++) {
            const next = anchor.next;
            removed.addToTail(anchor.value);
            this.removeAt(anchor.key);
            anchor = next;
        }
        if (anchor) {
            for (const item of items)
                this.addBefore(anchor.key, item);
        }
        else {
            for (const item of items)
                this.addToTail(item);
        }
        return removed;
    }
    // --- Iteration / reduction ------------------------------------------------
    map(callback) {
        const result = new LinkedList();
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            result.addToTail(callback(node.value, i, this));
        }
        return result;
    }
    filter(predicate) {
        const result = new LinkedList();
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            if (predicate(node.value, i, this))
                result.addToTail(node.value);
        }
        return result;
    }
    find(predicate) {
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            if (predicate(node.value, i, this))
                return node.value;
        }
        return undefined;
    }
    findIndex(predicate) {
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            if (predicate(node.value, i, this))
                return i;
        }
        return -1;
    }
    findLast(predicate) {
        let i = this.length - 1;
        for (let node = this.tail; node; node = node.parent, i--) {
            if (predicate(node.value, i, this))
                return node.value;
        }
        return undefined;
    }
    findLastIndex(predicate) {
        let i = this.length - 1;
        for (let node = this.tail; node; node = node.parent, i--) {
            if (predicate(node.value, i, this))
                return i;
        }
        return -1;
    }
    every(predicate) {
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            if (!predicate(node.value, i, this))
                return false;
        }
        return true;
    }
    some(predicate) {
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            if (predicate(node.value, i, this))
                return true;
        }
        return false;
    }
    reduce(callback, initialValue) {
        let acc = initialValue;
        let node = this.head;
        let index = 0;
        if (arguments.length < 2) {
            if (!node)
                throw new TypeError('Reduce of empty list with no initial value');
            acc = node.value;
            node = node.next;
            index = 1;
        }
        for (; node; node = node.next, index++) {
            acc = callback(acc, node.value, index, this);
        }
        return acc;
    }
    reduceRight(callback, initialValue) {
        let acc = initialValue;
        let node = this.tail;
        let index = this.length - 1;
        if (arguments.length < 2) {
            if (!node)
                throw new TypeError('Reduce of empty list with no initial value');
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
    slice(start = 0, end) {
        const len = this.length;
        const s = start < 0 ? Math.max(len + start, 0) : Math.min(start, len);
        const e = end === undefined ? len : end < 0 ? Math.max(len + end, 0) : Math.min(end, len);
        const result = new LinkedList();
        let i = 0;
        for (let node = this.head; node && i < e; node = node.next, i++) {
            if (i >= s)
                result.addToTail(node.value);
        }
        return result;
    }
    /** Materializes the list into a native array, head first. */
    ToList() {
        return [...this.values()];
    }
    concat(...items) {
        const result = this.slice();
        for (const item of items) {
            if (item instanceof LinkedList) {
                for (let node = item.head; node; node = node.next)
                    result.addToTail(node.value);
            }
            else if (Array.isArray(item)) {
                for (const v of item)
                    result.addToTail(v);
            }
            else {
                result.addToTail(item);
            }
        }
        return result;
    }
    flatMap(callback) {
        const result = new LinkedList();
        let i = 0;
        for (let node = this.head; node; node = node.next, i++) {
            const mapped = callback(node.value, i, this);
            if (mapped instanceof LinkedList) {
                for (let n = mapped.head; n; n = n.next)
                    result.addToTail(n.value);
            }
            else if (Array.isArray(mapped)) {
                for (const v of mapped)
                    result.addToTail(v);
            }
            else {
                result.addToTail(mapped);
            }
        }
        return result;
    }
    flat(depth = 1) {
        const result = new LinkedList();
        const addFlattened = (value, d) => {
            if (d > 0 && (value instanceof LinkedList || Array.isArray(value))) {
                const inner = value instanceof LinkedList ? value.values() : value;
                for (const v of inner)
                    addFlattened(v, d - 1);
            }
            else {
                result.addToTail(value);
            }
        };
        for (let node = this.head; node; node = node.next)
            addFlattened(node.value, depth);
        return result;
    }
    // --- Immutable (ES2023) variants ------------------------------------------
    with(index, value) {
        const len = this.length;
        const i = index < 0 ? len + index : index;
        if (i < 0 || i >= len)
            throw new RangeError('Invalid index : ' + index);
        const result = new LinkedList();
        let idx = 0;
        for (let node = this.head; node; node = node.next, idx++) {
            result.addToTail(idx === i ? value : node.value);
        }
        return result;
    }
    toReversed() {
        const copy = this.slice();
        copy.reverse();
        return copy;
    }
    toSorted(compareFn) {
        const copy = this.slice();
        if (compareFn)
            copy.sort(compareFn);
        else
            copy.sort();
        return copy;
    }
    toSpliced(start, deleteCount, ...items) {
        const copy = this.slice();
        if (deleteCount === undefined)
            copy.splice(start);
        else
            copy.splice(start, deleteCount, ...items);
        return copy;
    }
    // --- Stringification ------------------------------------------------------
    join(separator = ',') {
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
    toString() {
        return this.join();
    }
    toLocaleString() {
        let result = '';
        let first = true;
        for (let node = this.head; node; node = node.next) {
            const v = node.value;
            const s = v === null || v === undefined
                ? ''
                : v.toLocaleString();
            result = first ? s : result + ',' + s;
            first = false;
        }
        return result;
    }
    // --- Iterators ------------------------------------------------------------
    *values() {
        for (let node = this.head; node; node = node.next)
            yield node.value;
    }
    *keys() {
        for (let i = 0; i < this.length; i++)
            yield i;
    }
    *entries() {
        let i = 0;
        for (let node = this.head; node; node = node.next)
            yield [i++, node.value];
    }
    [Symbol.iterator]() {
        return this.values();
    }
    // --- Static constructors --------------------------------------------------
    static isLinkedList(value) {
        return value instanceof LinkedList;
    }
    static of(...items) {
        const list = new LinkedList();
        for (const item of items)
            list.addToTail(item);
        return list;
    }
    static from(iterable, mapFn) {
        const list = new LinkedList();
        if (iterable != null && typeof iterable[Symbol.iterator] === 'function') {
            let i = 0;
            for (const v of iterable) {
                list.addToTail(mapFn ? mapFn(v, i) : v);
                i++;
            }
        }
        else {
            const arrayLike = iterable;
            for (let i = 0; i < arrayLike.length; i++) {
                const v = arrayLike[i];
                list.addToTail(mapFn ? mapFn(v, i) : v);
            }
        }
        return list;
    }
}
function defaultSort(a, b) {
    const aStr = a === null ? 'null' : String(a);
    const bStr = b === null ? 'null' : String(b);
    return aStr < bStr ? -1 : 1;
}
//# sourceMappingURL=FastList.js.map