import { describe, it, expect } from "vitest";
import { ResolveInputActions } from "../../Systems.Gameloop/ResolveInputActions.ts";
import { GameKeyboardEvent } from "../../Contracts/Events/KeyBoardEvent.ts";
import { InputResources } from "../../Contracts/SystemResources.ts";
import { ActionListener } from "../../Contracts/Components/ActionListener.ts";
import type { GameAction } from "../../Contracts/Actions/GameActions.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { PruneDeadLayers, PushInputLayer } from "../../Systems.Framework/InputLayerStack.ts";
import type { Entity } from "../../Contracts/Components/Entity.ts";
import type { GlobalRegistry } from "../../Systems.Framework/Registry.ts";

const KeyDown = (code : string, modifiers : Partial<KeyboardEvent> = {}) =>
  new GameKeyboardEvent({ code, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...modifiers } as KeyboardEvent, true);

const KeyUp = (code : string) =>
  new GameKeyboardEvent({ code, altKey: false, shiftKey: false, ctrlKey: false, metaKey: false } as KeyboardEvent, false);

/** A world with an input stack and no listeners on it yet. */
function BuildWorld() {
  return { registry: BuildTestRegistry(), input: new InputResources() }
}

type World = ReturnType<typeof BuildWorld>

/** Adds a listener entity claiming `actions` on `layer`, and returns it. */
function AddListener(world : World, layer : Entity, ...actions : GameAction[]) : Entity {
  return new EntityBuilder(world.registry).AddActionListener(layer, ...actions).GetEntity()
}

function Resolve(world : World, events : GameKeyboardEvent[]) {
  const queue = new EventQueue(new LinkedList())

  events.forEach((event)=>queue.EnqueueEvent(event))
  ResolveInputActions(world.registry, queue, world.input)
}

const Triggered = (registry : GlobalRegistry, entity : Entity) => [...(registry.GetComponent(entity, ActionListener)?.triggered ?? [])]
const Held = (registry : GlobalRegistry, entity : Entity) => [...(registry.GetComponent(entity, ActionListener)?.held ?? [])]

describe("keys become actions", () => {
  it("delivers the bound action, not the key", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    Resolve(world, [KeyDown("KeyD")])

    expect(Triggered(world.registry, listener)).toEqual(["PanCameraRight"])
  })

  it("ignores a key bound to nothing", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    Resolve(world, [KeyDown("KeyQ")])

    expect(Triggered(world.registry, listener)).toEqual([])
  })

  // The indirection is the point: rebinding moves the action to a new key and
  // nothing downstream is aware it happened.
  it("follows a rebind", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    world.input.bindings.Rebind("PanCameraRight", ["KeyL"])
    Resolve(world, [KeyDown("KeyL")])

    expect(Triggered(world.registry, listener)).toEqual(["PanCameraRight"])
  })

  it("stops delivering on the old key after a rebind", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    world.input.bindings.Rebind("PanCameraRight", ["KeyL"])
    Resolve(world, [KeyDown("KeyD")])

    expect(Triggered(world.registry, listener)).toEqual([])
  })
})

describe("layers are transparent per action", () => {
  it("gives a claimed action to the topmost claimant", () => {
    const world = BuildWorld()
    const lower = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")
    const upper = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    Resolve(world, [KeyDown("Space")])

    expect(Triggered(world.registry, upper)).toEqual(["Interact"])
    expect(Triggered(world.registry, lower)).toEqual([])
  })

  // The submenu case: a layer that takes only the keys it uses leaves the rest
  // working, so the menu underneath does not have to be rebuilt to survive it.
  it("falls through an action the top layer does not claim", () => {
    const world = BuildWorld()
    const lower = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    Resolve(world, [KeyDown("KeyD")])

    expect(Triggered(world.registry, lower)).toEqual(["PanCameraRight"])
  })

  it("delivers to every listener on the winning layer", () => {
    const world = BuildWorld()
    const layer = PushInputLayer(world.registry, world.input)
    const first = AddListener(world, layer, "Interact")
    const second = AddListener(world, layer, "Interact")

    Resolve(world, [KeyDown("Space")])

    expect(Triggered(world.registry, first)).toEqual(["Interact"])
    expect(Triggered(world.registry, second)).toEqual(["Interact"])
  })

  it("drops an action nothing claims", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    Resolve(world, [KeyDown("KeyD")])

    expect(Triggered(world.registry, listener)).toEqual([])
  })

  // Popping restores the layer below, which is what makes a submenu closing
  // hand its bindings back rather than needing them re-registered.
  it("hands an action back when the layer above goes", () => {
    const world = BuildWorld()
    const lower = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")
    const upperLayer = PushInputLayer(world.registry, world.input)

    AddListener(world, upperLayer, "Interact")

    Resolve(world, [KeyDown("Space")])
    expect(Triggered(world.registry, lower)).toEqual([])

    // Released first, or the second press is an OS repeat of a key that never
    // came up and is correctly not an edge.
    Resolve(world, [KeyUp("Space")])

    world.registry.DestroyEntity(upperLayer)
    Resolve(world, [KeyDown("Space")])

    expect(Triggered(world.registry, lower)).toEqual(["Interact"])
  })
})

describe("blackout layers", () => {
  it("swallows an action nothing above it claims", () => {
    const world = BuildWorld()
    const gameplay = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    PushInputLayer(world.registry, world.input, undefined, true)
    AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    Resolve(world, [KeyDown("KeyD")])

    expect(Triggered(world.registry, gameplay)).toEqual([])
  })

  // It stops the fall, it does not stop the menu: the blackout goes UNDER the
  // menu layer precisely so the menu still hears its own keys.
  it("leaves the layers above it alone", () => {
    const world = BuildWorld()

    AddListener(world, PushInputLayer(world.registry, world.input), "Interact")
    PushInputLayer(world.registry, world.input, undefined, true)

    const menu = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    Resolve(world, [KeyDown("Space")])

    expect(Triggered(world.registry, menu)).toEqual(["Interact"])
  })

  it("swallows held actions too, so the camera stops", () => {
    const world = BuildWorld()
    const camera = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    Resolve(world, [KeyDown("KeyD")])
    expect(Held(world.registry, camera)).toEqual(["PanCameraRight"])

    PushInputLayer(world.registry, world.input, undefined, true)
    Resolve(world, [])

    expect(Held(world.registry, camera)).toEqual([])
  })
})

describe("held versus triggered", () => {
  it("keeps an action held on frames with no events", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    Resolve(world, [KeyDown("KeyD")])
    Resolve(world, [])

    expect(Held(world.registry, listener)).toEqual(["PanCameraRight"])
  })

  // Triggered is an edge. A menu row that re-invoked itself every frame the key
  // was down would be unusable.
  it("triggers only on the frame of the press", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    Resolve(world, [KeyDown("KeyD")])
    Resolve(world, [])

    expect(Triggered(world.registry, listener)).toEqual([])
  })

  // The OS repeats keydown while a key is held; only the first is an edge.
  it("does not re-trigger on an OS key repeat", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    Resolve(world, [KeyDown("Space")])
    Resolve(world, [KeyDown("Space")])

    expect(Triggered(world.registry, listener)).toEqual([])
  })

  it("stops holding on release", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    Resolve(world, [KeyDown("KeyD")])
    Resolve(world, [KeyUp("KeyD")])

    expect(Held(world.registry, listener)).toEqual([])
  })

  it("triggers again after a release and a second press", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    Resolve(world, [KeyDown("Space")])
    Resolve(world, [KeyUp("Space")])
    Resolve(world, [KeyDown("Space")])

    expect(Triggered(world.registry, listener)).toEqual(["Interact"])
  })

  it("ignores a modified press but still releases a modified release", () => {
    const world = BuildWorld()
    const listener = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    Resolve(world, [KeyDown("KeyD", { ctrlKey: true })])
    expect(Held(world.registry, listener)).toEqual([])

    Resolve(world, [KeyDown("KeyD")])
    Resolve(world, [new GameKeyboardEvent({ code: "KeyD", ctrlKey: true } as KeyboardEvent, false)])

    expect(Held(world.registry, listener)).toEqual([])
  })
})

describe("dead layers", () => {
  // Nothing tells the stack an entity died -- DestroyEntity cascades through
  // components, and a stale handle in an array is invisible to it.
  it("are pruned from the stack", () => {
    const world = BuildWorld()
    const layer = PushInputLayer(world.registry, world.input)

    world.registry.DestroyEntity(layer)
    Resolve(world, [])

    expect(world.input.layerStack).toHaveLength(0)
  })

  it("do not swallow input while they linger", () => {
    const world = BuildWorld()
    const gameplay = AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")
    const blackout = PushInputLayer(world.registry, world.input, undefined, true)

    world.registry.DestroyEntity(blackout)
    Resolve(world, [KeyDown("KeyD")])

    expect(Triggered(world.registry, gameplay)).toEqual(["PanCameraRight"])
  })

  it("leaves a healthy stack untouched", () => {
    const world = BuildWorld()
    const first = PushInputLayer(world.registry, world.input)
    const second = PushInputLayer(world.registry, world.input)

    PruneDeadLayers(world.registry, world.input)

    expect(world.input.layerStack).toEqual([first, second])
  })
})

// The requirement this whole design hangs on: a listener is a component on the
// entity, so it cannot outlive it, and Owns carries that down a whole subtree.
describe("listeners die with their entity", () => {
  it("stops hearing once destroyed", () => {
    const world = BuildWorld()
    const layer = PushInputLayer(world.registry, world.input)
    const listener = AddListener(world, layer, "Interact")

    world.registry.DestroyEntity(listener)

    expect(()=>Resolve(world, [KeyDown("Space")])).not.toThrow()
    expect(world.registry.GetComponent(listener, ActionListener)).toBeUndefined()
  })

  it("hands its actions back to the layer below", () => {
    const world = BuildWorld()
    const lower = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")
    const upper = AddListener(world, PushInputLayer(world.registry, world.input), "Interact")

    world.registry.DestroyEntity(upper)
    Resolve(world, [KeyDown("Space")])

    expect(Triggered(world.registry, lower)).toEqual(["Interact"])
  })

  // What a menu relies on: it owns its layers, so destroying the root pops them.
  it("takes owned layers down with the owner", () => {
    const world = BuildWorld()

    AddListener(world, PushInputLayer(world.registry, world.input), "PanCameraRight")

    const owner = world.registry.CreateEntity()

    PushInputLayer(world.registry, world.input, owner, true)
    PushInputLayer(world.registry, world.input, owner)

    expect(world.input.layerStack).toHaveLength(3)

    world.registry.DestroyEntity(owner)
    Resolve(world, [])

    expect(world.input.layerStack).toHaveLength(1)
  })
})
