import { MoveHintGlyph, MoveHintLayer } from "../Configuration/DisplayConstants.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { Layer } from "../Contracts/Layer.ts";
import { MoveHint } from "../Contracts/MoveHint.ts";
import { Representation } from "../Contracts/Representation.ts";
import { SelectionUpdateEvent } from "../Contracts/SelectionUpdate.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "./EntityBuilder.ts";
import { GetLegalMoves } from "./GetLegalMoves.ts";

/**
 * Paints a marker on every square the just-selected piece may reach, and clears them
 * again when it is deselected or moves. Driven by the same SelectionUpdateEvent that
 * HandleColorChanges listens to: a `true` means a piece was picked up, a `false` means
 * it was put down (deselected, or moved — HandleMovement emits the deselect for both).
 */
export function HandleMoveHints (registry : IRegistry, eventQueue : IEventQueue) {
    const events = eventQueue.GetEventsOfType(SelectionUpdateEvent)

    if (events.length === 0) return

    for (const event of events) {
        ClearHints(registry)

        if (event.newSelection) ShowHintsFor(registry, event.selectionUpdateSource)
    }
}

function ClearHints (registry : IRegistry) {
    const hints : Entity[] = []

    registry.ForEachEntityWith([MoveHint], (entity)=>{ hints.push(entity) })

    for (const hint of hints) registry.DestroyEntity(hint)
}

/** One marker per legal destination, tinted to match the piece it belongs to. */
function ShowHintsFor (registry : IRegistry, piece : Entity) {
    const color = registry.GetComponent(piece, Representation)?.color

    for (const destination of GetLegalMoves(piece, registry)) {
        const marker = new EntityBuilder(registry)
            .AddPosition(destination)
            .AddLayer(new Layer(MoveHintLayer))
            .GetEntity()

        const glyphColor = color !== undefined? color.Copy() : undefined

        if (glyphColor !== undefined) registry.RegisterEntity(marker, Representation, new Representation(MoveHintGlyph, glyphColor))

        registry.RegisterEntity(marker, MoveHint, new MoveHint())
    }
}
