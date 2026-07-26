import type { IKeyValueStore } from "../../Interfaces/IKeyValueStore.ts";
/**
 * A key-value store backed by a Map, with no persistence across sessions.
 *
 * Used by tests, and as the fallback when the runtime has no localStorage, so
 * that saving is always a working no-op rather than a crash.
 */
export declare class InMemoryKeyValueStore implements IKeyValueStore {
    private _entries;
    GetItem(key: string): string | null;
    SetItem(key: string, value: string): void;
    RemoveItem(key: string): void;
}
//# sourceMappingURL=InMemoryKeyValueStore.d.ts.map