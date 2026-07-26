// The ONE file that knows how an Entity is represented.
//
// An Entity is an opaque 31-bit integer packing a slot index and a generation
// ("version"). It is branded, so neither an arbitrary number nor an arbitrary
// object is assignable to Entity -- only EntityHandle.Make may mint one.
//
// Layout (bit 31 is deliberately left clear, so every packed handle is a
// positive int32; JS bitwise operators coerce to *signed* int32, so a 20/12
// layout would put the version's top bit on the sign bit and produce negative
// handles, forcing `>>> 0` at every call site):
//
//   bit 30 .. 20   version   (11 bits, 1 .. 2047)
//   bit 19 ..  0   index     (20 bits, 0 .. 1048575)
//
// Versions start at 1 and never take the value 0, so a live handle is never
// numerically 0. That reserves 0 as NullEntity and guarantees no live entity
// is ever falsy.
//
// LIMITATION: a handle held across 2047 destroy/reuse cycles OF THE SAME SLOT
// can alias a different entity. This is the standard EnTT/flecs tradeoff and is
// unreachable at chess scale (~98 entities). Widening the version field is a
// change to this file alone -- but see the sign-bit note above.
export const IndexBits = 20;
export const VersionBits = 11;
export const MaxEntityIndex = (1 << IndexBits) - 1; // 1_048_575
export const MaxEntityVersion = (1 << VersionBits) - 1; //     2_047
/** The absence of an entity. Never returned by CreateEntity. */
export const NullEntity = 0;
export const EntityHandle = {
    /**
     * Packs a slot index and a version into a handle.
     * `version` must be in 1..MaxEntityVersion; 0 is reserved for NullEntity.
     */
    Make(index, version) {
        if (index < 0 || index > MaxEntityIndex) {
            throw new RangeError(`Entity index ${index} outside 0..${MaxEntityIndex}`);
        }
        if (version < 1 || version > MaxEntityVersion) {
            throw new RangeError(`Entity version ${version} outside 1..${MaxEntityVersion}`);
        }
        return (((version & MaxEntityVersion) << IndexBits) | (index & MaxEntityIndex));
    },
    /** Storage slot. The only thing a sparse/dense component registry needs. */
    Index(entity) {
        return entity & MaxEntityIndex;
    },
    /** Generation counter; distinguishes a recycled slot from its predecessor. */
    Version(entity) {
        return (entity >>> IndexBits) & MaxEntityVersion;
    },
    /**
     * Value equality. Identical to `a === b` for handles -- it exists so call
     * sites read as intent rather than as integer comparison, and so the
     * representation can change without touching them.
     */
    Equals(a, b) {
        return a === b;
    },
    /** Human-readable form for logs and error messages. */
    ToString(entity) {
        if (entity === NullEntity)
            return "Entity(null)";
        return `Entity(#${EntityHandle.Index(entity)}v${EntityHandle.Version(entity)})`;
    },
};
//# sourceMappingURL=Entity.js.map