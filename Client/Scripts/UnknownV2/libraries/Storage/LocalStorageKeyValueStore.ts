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
export class LocalStorageKeyValueStore implements IKeyValueStore {
    GetItem(key : string) : string | null {
        try {
            return globalThis.localStorage.getItem(key)
        } catch (error) {
            console.warn(`Could not read "${key}" from localStorage.`, error)
            return null
        }
    }

    SetItem(key : string, value : string) : void {
        try {
            globalThis.localStorage.setItem(key, value)
        } catch (error) {
            console.warn(`Could not write "${key}" to localStorage; the value was dropped.`, error)
        }
    }

    RemoveItem(key : string) : void {
        try {
            globalThis.localStorage.removeItem(key)
        } catch (error) {
            console.warn(`Could not remove "${key}" from localStorage.`, error)
        }
    }
}
