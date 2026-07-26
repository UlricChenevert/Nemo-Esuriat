import type { IKeyValueStore } from "../../Interfaces/IKeyValueStore.ts";
/**
 * The store appropriate to the current runtime: localStorage in a browser, an
 * in-memory Map anywhere else.
 *
 * The feature test is what lets the game and its systems be constructed under
 * vitest with no DOM. Nothing else in the codebase touches localStorage
 * directly, so this is the only place that has to know it might be missing.
 */
export declare function CreateDefaultKeyValueStore(): IKeyValueStore;
//# sourceMappingURL=CreateDefaultKeyValueStore.d.ts.map