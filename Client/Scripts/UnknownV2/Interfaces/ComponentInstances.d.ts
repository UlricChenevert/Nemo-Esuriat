import type { IClassConstructor } from "./IClassConstructor.ts";
export type ComponentInstances<T extends readonly IClassConstructor<unknown>[]> = {
    [K in keyof T]: T[K] extends IClassConstructor<infer C> ? C : never;
};
//# sourceMappingURL=ComponentInstances.d.ts.map