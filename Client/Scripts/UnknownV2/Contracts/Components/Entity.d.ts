declare const EntityBrand: unique symbol;
export type Entity = number & {
    readonly [EntityBrand]: true;
};
export declare const IndexBits = 20;
export declare const VersionBits = 11;
export declare const MaxEntityIndex: number;
export declare const MaxEntityVersion: number;
/** The absence of an entity. Never returned by CreateEntity. */
export declare const NullEntity: Entity;
export declare const EntityHandle: {
    /**
     * Packs a slot index and a version into a handle.
     * `version` must be in 1..MaxEntityVersion; 0 is reserved for NullEntity.
     */
    readonly Make: (index: number, version: number) => Entity;
    /** Storage slot. The only thing a sparse/dense component registry needs. */
    readonly Index: (entity: Entity) => number;
    /** Generation counter; distinguishes a recycled slot from its predecessor. */
    readonly Version: (entity: Entity) => number;
    /**
     * Value equality. Identical to `a === b` for handles -- it exists so call
     * sites read as intent rather than as integer comparison, and so the
     * representation can change without touching them.
     */
    readonly Equals: (a: Entity, b: Entity) => boolean;
    /** Human-readable form for logs and error messages. */
    readonly ToString: (entity: Entity) => string;
};
export {};
//# sourceMappingURL=Entity.d.ts.map