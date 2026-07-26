/**
 * A key-value store backed by a Map, with no persistence across sessions.
 *
 * Used by tests, and as the fallback when the runtime has no localStorage, so
 * that saving is always a working no-op rather than a crash.
 */
export class InMemoryKeyValueStore {
    _entries = new Map();
    GetItem(key) {
        // Normalises "absent" to null, matching the Web Storage contract that
        // callers are written against.
        return this._entries.get(key) ?? null;
    }
    SetItem(key, value) {
        this._entries.set(key, value);
    }
    RemoveItem(key) {
        this._entries.delete(key);
    }
}
//# sourceMappingURL=InMemoryKeyValueStore.js.map