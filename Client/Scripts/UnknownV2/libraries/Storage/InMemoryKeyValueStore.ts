import type { IKeyValueStore } from "../../Interfaces/IKeyValueStore.ts";

/**
 * A key-value store backed by a Map, with no persistence across sessions.
 *
 * Used by tests, and as the fallback when the runtime has no localStorage, so
 * that saving is always a working no-op rather than a crash.
 */
export class InMemoryKeyValueStore implements IKeyValueStore {
    private _entries = new Map<string, string>()

    GetItem(key : string) : string | null {
        // Normalises "absent" to null, matching the Web Storage contract that
        // callers are written against.
        return this._entries.get(key) ?? null
    }

    SetItem(key : string, value : string) : void {
        this._entries.set(key, value)
    }

    RemoveItem(key : string) : void {
        this._entries.delete(key)
    }
}
