import type { Entity } from "../Contracts/Components/Entity.ts";
import { InputLayer } from "../Contracts/Components/InputLayer.ts";
import type { InputResources } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { EntityBuilder } from "./EntityBuilder.ts";

/**
 * Creates a layer entity and puts it on top of the input stack.
 *
 * `owner` is what makes the stack self-maintaining: the layer becomes an owned
 * child, so destroying the menu (or unit, or whatever pushed it) destroys the
 * layer, and PruneDeadLayers drops it on the next frame. Callers that pop
 * explicitly still may; this is the safety net for the paths that do not.
 */
export function PushInputLayer (registry : IRegistry, input : InputResources, owner? : Entity, blackout = false) : Entity {
    const builder = new EntityBuilder(registry)

    if (owner !== undefined) builder.AddOwner(owner)

    const layer = builder.GetEntity()

    registry.RegisterEntity(layer, InputLayer, new InputLayer(blackout))
    input.layerStack.push(layer)

    return layer
}

/** Pops and destroys the topmost layer, if there is one. */
export function PopInputLayer (registry : IRegistry, input : InputResources) : Entity | undefined {
    const layer = input.layerStack.pop()

    if (layer === undefined) return undefined

    registry.DestroyEntity(layer)

    return layer
}

/** Removes a layer wherever it sits, without destroying it. */
export function RemoveInputLayer (input : InputResources, layer : Entity) : boolean {
    const index = input.layerStack.indexOf(layer)

    if (index === -1) return false

    input.layerStack.splice(index, 1)

    return true
}

/**
 * Drops layers whose entity is gone.
 *
 * Run at the top of every resolution pass rather than at destruction time,
 * because nothing tells the stack that an entity died -- DestroyEntity strips
 * components and cascades through Owns, and a stale handle in an array is
 * invisible to it. Checking here costs one IsAlive per layer, and the stack is
 * a handful of entries deep.
 */
export function PruneDeadLayers (registry : IRegistry, input : InputResources) : void {
    // Almost always a no-op, so pay for the filter allocation only when something
    // actually died.
    if (input.layerStack.every((layer)=>registry.IsAlive(layer))) return

    input.layerStack = input.layerStack.filter((layer)=>registry.IsAlive(layer))
}

/** True if the layer exists and is a blackout layer. */
export function IsBlackoutLayer (registry : IRegistry, layer : Entity) : boolean {
    return registry.GetComponent(layer, InputLayer)?.blackout === true
}

/**
 * The listeners on the topmost layer that claims this piece of input, or undefined when
 * nothing hears it -- including the case where a blackout layer deliberately eats it.
 *
 * Walks the stack from the top so the first claimant found is the one closest to the
 * player's attention. A layer is transparent: it intercepts only what its listeners
 * claim, and everything else falls through to the layer beneath. That is what lets a
 * submenu take Up/Down while the menu under it keeps its own bindings for when the
 * submenu pops -- and, with clicks routed the same way, what lets a debug layer take
 * ctrl+click while ordinary clicks still reach the world.
 *
 * Generic over the listener because keys and clicks are different kinds of input asking
 * the same question. Two copies of this walk would be two places for the blackout rule
 * to be got subtly wrong.
 */
export function ResolveTopClaimingLayer<Listener> (
    registry : IRegistry,
    input : InputResources,
    listenersByLayer : Map<Entity, Listener[]>,
    Claims : (listener : Listener) => boolean
) : Listener[] | undefined {
    for (let index = input.layerStack.length - 1; index >= 0; index--) {
        const layer = input.layerStack[index]!

        if (registry.GetComponent(layer, InputLayer)?.blackout) return undefined

        const claimants = listenersByLayer.get(layer)?.filter(Claims)

        if (claimants !== undefined && claimants.length > 0) return claimants
    }

    return undefined
}
