/**
 * A minimal string-keyed persistence surface, modelled on the subset of the Web
 * Storage API the game actually uses.
 *
 * This exists as an interface so persistence can be swapped for an in-memory
 * implementation in tests, and so the game runs unchanged in environments with
 * no localStorage at all (vitest without a DOM).
 */
export interface IKeyValueStore {
    /** The stored value, or null when the key is absent. */
    GetItem(key: string): string | null;
    /** Stores the value. Implementations must not throw when storage is full. */
    SetItem(key: string, value: string): void;
    RemoveItem(key: string): void;
}
//# sourceMappingURL=IKeyValueStore.d.ts.map