import { TerrainKindNames } from "../Configuration/DisplayConstants.ts";
import { ClickListener } from "../Contracts/Components/ClickListener.ts";
import { type Entity, EntityHandle } from "../Contracts/Components/Entity.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Position } from "../Contracts/Components/Position.ts";
import type { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { FindCameraPosition, WorldTileOfScreenTile } from "../Utilities/CameraUtilities.ts";
import { isSameTile } from "../Utilities/PositionUtilities.ts";
import { TerrainKindAtWorldTile } from "../Utilities/TerrainUtilities.ts";

/**
 * Prints what is standing on a clicked tile, and what it is made of.
 *
 * The tool for answering "why is that deer doing that" without adding a console.log to
 * whichever system is currently suspected. Every behavioural bug in the herd AI so far
 * has come down to the value of a component at a moment -- which state the herd is in,
 * how thirsty it thinks it is, whether it is holding a stale destination -- and all of
 * that is a click away rather than a rebuild away.
 *
 * Reads its clicks from a ClickListener like any other consumer, so it takes part in the
 * layer stack rather than sitting outside it: it claims the Control gesture on a layer
 * pushed above the world's, which is what makes ctrl+click inspect while an ordinary
 * click still commands units.
 *
 * Scheduled only when GameConstants.Debug is set, so with debugging off this does not run
 * and its layer is never pushed.
 */
export function InspectEntities (registry : IRegistry, world : WorldStreamingResources, inspector : Entity) {
    const clicks = registry.GetComponent(inspector, ClickListener)?.clicks ?? []

    if (clicks.length == 0) return

    const cameraPosition = FindCameraPosition(registry)

    // Without a camera there is no mapping from what was clicked to where it is. Nothing
    // to report rather than something misleading.
    if (cameraPosition === undefined) return

    for (const click of clicks) {
        const worldPosition = WorldTileOfScreenTile(cameraPosition, click.screenX, click.screenY)

        ReportTile(registry, world, worldPosition)
    }
}

function ReportTile (registry : IRegistry, world : WorldStreamingResources, worldPosition : Position) {
    const tileX = Math.floor(worldPosition.x)
    const tileY = Math.floor(worldPosition.y)

    // The ground is reported whatever else is there. Terrain is a single chunk entity
    // anchored at its top-left corner, so it can never be found by matching tiles the way
    // everything else is -- and "what is this animal standing on" is usually half the
    // question being asked anyway.
    const terrainKind = TerrainKindAtWorldTile(world, tileX, tileY)

    console.log(`--- tile (${tileX}, ${tileY}) : ${TerrainKindNames[terrainKind] ?? terrainKind} ---`)

    const found : Entity[] = []

    registry.ForEachEntityWith([Position], (entity, position)=>{
        if (isSameTile(position, worldPosition)) found.push(entity)
    })

    if (found.length == 0) {
        console.log("  (nothing here)")
        return
    }

    for (const entity of found) {
        console.log(`  ${EntityHandle.ToString(entity)}`, ComponentsOf(registry, entity))

        const ownedBy = registry.GetComponent(entity, OwnedBy)

        // The owner is where a herd animal's real story is: the animal carries its own
        // appetites, but the state that explains its behaviour -- what the herd decided,
        // where it is going, how long it has been stuck -- lives on the herd. Reporting
        // one without the other would answer half of every question.
        if (ownedBy === undefined) continue

        if (!registry.IsAlive(ownedBy.owner)) {
            console.log(`    owner ${EntityHandle.ToString(ownedBy.owner)} is dead`)
            continue
        }

        console.log(`    owner ${EntityHandle.ToString(ownedBy.owner)}`, ComponentsOf(registry, ownedBy.owner))
    }
}

/**
 * Everything an entity is made of, keyed by component name.
 *
 * A plain object rather than a Map because browser consoles render one as an inspectable
 * tree and the other as an opaque entry list.
 */
function ComponentsOf (registry : IRegistry, entity : Entity) : Record<string, unknown> {
    const components : Record<string, unknown> = {}

    registry.ForEachComponentOf(entity, (componentClass, component)=>{
        components[componentClass.name] = component
    })

    return components
}
