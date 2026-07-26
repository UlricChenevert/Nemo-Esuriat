import type { IKeyValueStore } from "../../Interfaces/IKeyValueStore.ts";
/**
 * Persists to the browser's localStorage.
 *
 * Every operation is guarded. localStorage throws for reasons that have nothing
 * to do with the caller — a full quota, or a browser configured to deny storage
 * access entirely — and these calls happen inside the game loop, where an
 * exception would take down the frame. A failed save costs the player some
 * saved state; a thrown save costs them the session.
 */
export declare class LocalStorageKeyValueStore implements IKeyValueStore {
    GetItem(key: string): string | null;
    SetItem(key: string, value: string): void;
    RemoveItem(key: string): void;
}
//# sourceMappingURL=LocalStorageKeyValueStore.d.ts.map