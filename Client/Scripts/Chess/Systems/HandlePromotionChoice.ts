import { BishopRepresentationLetter, CavalryRepresentationLetter, PromotionPickerLayer, QueenRepresentationLetter, RookRepresentationLetter } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Entity } from "../Contracts/Entity.ts";
import { GameClickEvent } from "../Contracts/GameClickEvent.ts";
import { Layer } from "../Contracts/Layer.ts";
import { MovementRules } from "../Contracts/MovementRules.ts";
import { OwnedBy } from "../Contracts/OwnedBy.ts";
import { PendingPromotion } from "../Contracts/PendingPromotion.ts";
import { Position } from "../Contracts/Position.ts";
import { PromotionCompletedEvent } from "../Contracts/PromotionCompletedEvent.ts";
import { PromotionOption } from "../Contracts/PromotionOption.ts";
import { Representation } from "../Contracts/Representation.ts";
import type { IEventQueue } from "../Interfaces/IEventQueue.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { isSamePosition } from "../Utilities/PositionUtilities.ts";
import { RulesByRepresentation } from "./ConfiguredMovementRules.ts";
import { EntityBuilder } from "./EntityBuilder.ts";

/** Offered in reading order across the picker row. */
export const PromotionChoices = [
    QueenRepresentationLetter,
    RookRepresentationLetter,
    BishopRepresentationLetter,
    CavalryRepresentationLetter,
]

/** Whether a pawn is currently waiting on a promotion choice. */
export function HasPendingPromotion (registry : IRegistry) : boolean {
    let pending = false

    registry.ForEachEntityWith([PendingPromotion], ()=>{ pending = true })

    return pending
}

/**
 * Turns a pawn into `letter`. The Representation letter drives attack scanning via
 * RulesByRepresentation, and the MovementRules component drives move generation, so
 * both have to be swapped or the piece will look like one thing and move like another.
 */
export function ApplyPromotion (registry : IRegistry, pawn : Entity, letter : string) {
    const rules = RulesByRepresentation[letter]

    if (rules === undefined) return

    const representation = registry.GetComponent(pawn, Representation)

    if (representation !== undefined) representation.model = letter

    registry.RegisterEntity(pawn, MovementRules, new MovementRules(rules.moves))
    registry.RemoveComponent(pawn, PendingPromotion)
}

/**
 * Runs the promotion prompt: spawns the picker for a waiting pawn, and resolves it when
 * one of its glyphs is clicked.
 *
 * The picker reads clicks straight off the queue rather than going through selection —
 * HandleInputEvents is deliberately suspended while a promotion is pending, so routing
 * the choice through it would mean unblocking the very thing that must stay blocked.
 */
export function HandlePromotionChoice (registry : IRegistry, eventQueue : IEventQueue) {
    const waiting = FindWaitingPawn(registry)

    if (waiting === undefined) {
        DespawnPicker(registry)
        return
    }

    if (!PickerExists(registry)) {
        SpawnPicker(registry, waiting)
        return
    }

    ResolveClick(registry, eventQueue)
}

function FindWaitingPawn (registry : IRegistry) : Entity | undefined {
    let waiting : Entity | undefined

    registry.ForEachEntityWith([PendingPromotion], (entity)=>{ waiting ??= entity })

    return waiting
}

function PickerExists (registry : IRegistry) : boolean {
    let exists = false

    registry.ForEachEntityWith([PromotionOption], ()=>{ exists = true })

    return exists
}

function DespawnPicker (registry : IRegistry) {
    const glyphs : Entity[] = []

    registry.ForEachEntityWith([PromotionOption], (entity)=>{ glyphs.push(entity) })

    for (const glyph of glyphs) registry.DestroyEntity(glyph)
}

/** A centred row of choices, painted in the promoting side's own colour. */
function SpawnPicker (registry : IRegistry, pawn : Entity) {
    const color = registry.GetComponent(pawn, Representation)?.color
    const row = Math.floor(GameWidth / 2)
    const firstFile = Math.floor((GameWidth - PromotionChoices.length) / 2)

    PromotionChoices.forEach((letter, offset)=>{
        const glyph = new EntityBuilder(registry)
            .AddPosition(new Position(firstFile + offset, row))
            .AddLayer(new Layer(PromotionPickerLayer))
            .GetEntity()

        if (color !== undefined) registry.RegisterEntity(glyph, Representation, new Representation(letter, color.Copy()))

        registry.RegisterEntity(glyph, PromotionOption, new PromotionOption(letter, pawn))
    })
}

function ResolveClick (registry : IRegistry, eventQueue : IEventQueue) {
    const clicks = eventQueue.GetEventsOfType(GameClickEvent)

    if (clicks.length === 0) return

    let chosen : PromotionOption | undefined

    registry.ForEachEntityWith([PromotionOption, Position], (_entity, option, position)=>{
        if (chosen !== undefined) return
        if (clicks.some((click)=>isSamePosition(click.position, position))) chosen = option
    })

    if (chosen === undefined) return

    const pawn = chosen.pawn
    const controller = registry.GetComponent(pawn, OwnedBy)?.owner

    ApplyPromotion(registry, pawn, chosen.letter)
    DespawnPicker(registry)

    // The move that triggered this only finishes now, so the systems that close out a
    // move have to be told — its GameMovementEvent was cleared frames ago.
    if (controller !== undefined) eventQueue.EnqueueEvent(new PromotionCompletedEvent(controller, pawn))
}
