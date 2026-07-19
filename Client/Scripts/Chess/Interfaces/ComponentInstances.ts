import type { IClassConstructor } from "./IClassConstructor";

// Maps a tuple of component constructors to a tuple of their instance types.
// e.g. [IClassConstructor<A>, IClassConstructor<B>] -> [A, B]
export type ComponentInstances<T extends readonly IClassConstructor<unknown>[]> = {
    [K in keyof T]: T[K] extends IClassConstructor<infer C> ? C : never
}
