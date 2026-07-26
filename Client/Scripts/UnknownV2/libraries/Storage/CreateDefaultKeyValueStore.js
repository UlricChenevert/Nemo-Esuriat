import { InMemoryKeyValueStore } from "./InMemoryKeyValueStore.js";
import { LocalStorageKeyValueStore } from "./LocalStorageKeyValueStore.js";
/**
 * The store appropriate to the current runtime: localStorage in a browser, an
 * in-memory Map anywhere else.
 *
 * The feature test is what lets the game and its systems be constructed under
 * vitest with no DOM. Nothing else in the codebase touches localStorage
 * directly, so this is the only place that has to know it might be missing.
 */
export function CreateDefaultKeyValueStore() {
    if (typeof globalThis.localStorage === "undefined")
        return new InMemoryKeyValueStore();
    return new LocalStorageKeyValueStore();
}
//# sourceMappingURL=CreateDefaultKeyValueStore.js.map