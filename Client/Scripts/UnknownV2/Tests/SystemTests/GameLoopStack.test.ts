import { describe, it, expect } from "vitest";
import { GameLoopLayer, ScheduleResources } from "../../Contracts/Schedule.ts";
import { PopLoopLayer, PushLoopLayer, RemoveLoopLayer, SetSystemEnabled } from "../../Systems.Framework/GameLoopStack.ts";
import { GameLoopChangedEvent } from "../../Contracts/Events/GameLoopChangedEvent.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import type { ISystemContext } from "../../Interfaces/ISystemContext.ts";

/**
 * A layer whose systems record that they ran, so "what actually executed" is a
 * list of strings rather than an assertion about side effects somewhere else.
 */
function BuildLayer(name : string, systemNames : string[], ranLog : string[]) {
  return new GameLoopLayer(name, systemNames.map((systemName)=>({
    name: systemName,
    enabled: true,
    run: ()=>{ ranLog.push(`${name}.${systemName}`) }
  })))
}

/** What GameLoop does, without needing a registry or a canvas to do it with. */
function RunFrame(schedule : ScheduleResources) {
  for (const system of schedule.ActiveLayer()?.EnabledSystems() ?? []) system.run({} as ISystemContext)
}

const BuildQueue = () => new EventQueue(new LinkedList())

describe("only the top layer runs", () => {
  it("runs the one layer on the stack", () => {
    const ran : string[] = []
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Gameplay", ["Move", "Draw"], ran))
    RunFrame(schedule)

    expect(ran).toEqual(["Gameplay.Move", "Gameplay.Draw"])
  })

  // The whole point of top-only: pushing a menu pauses the world without
  // anything having to know which gameplay systems were unsafe to keep running.
  it("leaves the layer beneath dormant", () => {
    const ran : string[] = []
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Gameplay", ["Move", "Draw"], ran))
    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Menu", ["Draw"], ran))
    RunFrame(schedule)

    expect(ran).toEqual(["Menu.Draw"])
  })

  it("resumes the layer beneath when the top pops", () => {
    const ran : string[] = []
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Gameplay", ["Move"], ran))
    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Menu", ["Draw"], ran))
    PopLoopLayer(schedule, BuildQueue())
    RunFrame(schedule)

    expect(ran).toEqual(["Gameplay.Move"])
  })

  it("runs nothing at all on an empty stack", () => {
    expect(()=>RunFrame(new ScheduleResources())).not.toThrow()
  })
})

describe("turning single systems on and off", () => {
  it("skips a disabled system and keeps the rest in order", () => {
    const ran : string[] = []
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Gameplay", ["Input", "Move", "Draw"], ran))
    SetSystemEnabled(schedule, BuildQueue(), "Gameplay", "Move", false)
    RunFrame(schedule)

    expect(ran).toEqual(["Gameplay.Input", "Gameplay.Draw"])
  })

  it("re-enables it again", () => {
    const ran : string[] = []
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Gameplay", ["Move"], ran))
    SetSystemEnabled(schedule, BuildQueue(), "Gameplay", "Move", false)
    SetSystemEnabled(schedule, BuildQueue(), "Gameplay", "Move", true)
    RunFrame(schedule)

    expect(ran).toEqual(["Gameplay.Move"])
  })

  it("reports a miss rather than throwing on an unknown name", () => {
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, BuildQueue(), BuildLayer("Gameplay", ["Move"], []))

    expect(SetSystemEnabled(schedule, BuildQueue(), "Gameplay", "Nonexistent", false)).toBe(false)
    expect(SetSystemEnabled(schedule, BuildQueue(), "NoSuchLayer", "Move", false)).toBe(false)
  })
})

describe("the change event", () => {
  /**
   * Changes are published with placeNext, because they happen mid-frame and the
   * queue is cleared at the end of it. Clearing is what promotes them, so these
   * read the queue the way the frame after the change would.
   */
  const ChangesAfterClear = (queue : EventQueue) => {
    queue.Clear()
    return queue.GetEventsOfType(GameLoopChangedEvent)
  }

  it("announces the new layer on push", () => {
    const queue = BuildQueue()
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, queue, BuildLayer("Gameplay", ["Move", "Draw"], []))

    const [change] = ChangesAfterClear(queue)

    expect(change?.layerName).toBe("Gameplay")
    expect(change?.systemNames).toEqual(["Move", "Draw"])
  })

  // The frame the push happens on still belongs to the old layer, so the event
  // must land on the next one -- the first frame the new list actually runs.
  it("is not visible on the frame the change was made", () => {
    const queue = BuildQueue()
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, queue, BuildLayer("Gameplay", ["Move"], []))

    expect(queue.GetEventsOfType(GameLoopChangedEvent)).toHaveLength(0)
  })

  it("announces the revealed layer on pop", () => {
    const queue = BuildQueue()
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, queue, BuildLayer("Gameplay", ["Move"], []))
    PushLoopLayer(schedule, queue, BuildLayer("Menu", ["Draw"], []))
    PopLoopLayer(schedule, queue)

    const changes = ChangesAfterClear(queue)

    expect(changes.at(-1)?.layerName).toBe("Gameplay")
    expect(changes.at(-1)?.systemNames).toEqual(["Move"])
  })

  it("announces an empty stack when the last layer pops", () => {
    const queue = BuildQueue()
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, queue, BuildLayer("Gameplay", ["Move"], []))
    PopLoopLayer(schedule, queue)

    const changes = ChangesAfterClear(queue)

    expect(changes.at(-1)?.layerName).toBeUndefined()
    expect(changes.at(-1)?.systemNames).toEqual([])
  })

  it("announces a system being disabled", () => {
    const queue = BuildQueue()
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, queue, BuildLayer("Gameplay", ["Input", "Move"], []))
    SetSystemEnabled(schedule, queue, "Gameplay", "Move", false)

    expect(ChangesAfterClear(queue).at(-1)?.systemNames).toEqual(["Input"])
  })

  // A dormant layer's contents do not describe what the loop will run, so
  // changing one is real but not a loop change worth announcing.
  it("stays quiet when a buried layer changes", () => {
    const queue = BuildQueue()
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, queue, BuildLayer("Gameplay", ["Move"], []))
    PushLoopLayer(schedule, queue, BuildLayer("Menu", ["Draw"], []))
    queue.Clear()
    queue.Clear()

    SetSystemEnabled(schedule, queue, "Gameplay", "Move", false)

    expect(ChangesAfterClear(queue)).toHaveLength(0)
  })

  it("stays quiet when a system is set to what it already was", () => {
    const queue = BuildQueue()
    const schedule = new ScheduleResources()

    PushLoopLayer(schedule, queue, BuildLayer("Gameplay", ["Move"], []))
    queue.Clear()
    queue.Clear()

    SetSystemEnabled(schedule, queue, "Gameplay", "Move", true)

    expect(ChangesAfterClear(queue)).toHaveLength(0)
  })

  it("stays quiet when popping an empty stack", () => {
    const queue = BuildQueue()

    PopLoopLayer(new ScheduleResources(), queue)

    expect(ChangesAfterClear(queue)).toHaveLength(0)
  })
})

// A menu whose owner is destroyed out from under it may not be on top any more,
// so closing has to take its own layer rather than whatever is topmost.
describe("removing a buried layer", () => {
  it("takes that layer and leaves the rest", () => {
    const ran : string[] = []
    const schedule = new ScheduleResources()
    const queue = BuildQueue()

    const gameplay = BuildLayer("Gameplay", ["Move"], ran)
    const menu = BuildLayer("Menu", ["Draw"], ran)
    const submenu = BuildLayer("Submenu", ["DrawSub"], ran)

    PushLoopLayer(schedule, queue, gameplay)
    PushLoopLayer(schedule, queue, menu)
    PushLoopLayer(schedule, queue, submenu)

    expect(RemoveLoopLayer(schedule, queue, menu)).toBe(true)

    RunFrame(schedule)

    expect(ran).toEqual(["Submenu.DrawSub"])
    expect(schedule.stack.map((layer)=>layer.name)).toEqual(["Gameplay", "Submenu"])
  })

  it("reports a miss for a layer that is not on the stack", () => {
    expect(RemoveLoopLayer(new ScheduleResources(), BuildQueue(), BuildLayer("Ghost", [], []))).toBe(false)
  })
})
