import {
    CollectionGainByNeed, FoodDrainPerSecond, HerdState, NeedKind, SleepDrainPerSecond,
    SleepRecoveryPerSecond, WaterDrainPerSecond
} from "../Configuration/HerdConstants.ts";
import { CollectingResource } from "../Contracts/Components/CollectingResource.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { HerdGoal } from "../Contracts/Components/HerdGoal.ts";
import { Needs } from "../Contracts/Components/Needs.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import type { TimeResources } from "../Contracts/SystemResources.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";

/**
 * Runs down every animal's appetites, pays out finished feeding and drinking, and
 * ages migration goals.
 *
 * The one place in the herd AI that knows what a second is. HandleAIMovement is a
 * pure function of world state and deliberately takes no clock: hysteresis there is
 * expressed as "what was the herd doing last tick" rather than as elapsed time, so
 * everything time-dependent concentrates here. That mirrors how HandleMovement is the
 * sole owner of per-second travel.
 *
 * Runs immediately BEFORE HandleAIMovement, for two reasons that pull the same way.
 * The decision trees branch on need levels and on whether a collection has finished,
 * so both have to be current -- an animal that finished drinking this tick must be
 * seen to have finished on this tick, or it stands in the water a frame longer than
 * it was told to and the herd re-decides against stale numbers. And running at the
 * END of the loop instead would charge a member that has only just begun collecting
 * for a tick it never stood still for.
 */
export function UpdateNeeds(registry : IRegistry, time : TimeResources) {
    const secondsThisTick = time.deltaSeconds

    DrainAppetites(registry, secondsThisTick)
    AdvanceCollections(registry, secondsThisTick)
    AgeMigrationGoals(registry, secondsThisTick)
}

/**
 * Food and water fall steadily; sleep falls while awake and climbs while the herd is
 * asleep.
 *
 * Everything is per second and multiplied by the tick length, so an animal gets hungry
 * at the same rate whether the display runs at 60Hz or 144Hz. Draining by a fixed
 * amount per frame instead would have the herd starve more than twice as fast on a
 * fast monitor.
 *
 * Every drain is then scaled by the body's own metabolismRate, so the constants above
 * describe an ordinary animal rather than every animal. Recovery is deliberately left
 * unscaled -- see Needs.metabolismRate.
 */
function DrainAppetites(registry : IRegistry, secondsThisTick : number) {
    registry.ForEachEntityWith([Needs], (entity, needs)=>{
        const burnedSeconds = secondsThisTick * needs.metabolismRate

        needs.Add(NeedKind.Food, -FoodDrainPerSecond * burnedSeconds)
        needs.Add(NeedKind.Water, -WaterDrainPerSecond * burnedSeconds)

        const asleep = OwningHerdState(registry, entity) === HerdState.Sleep

        needs.Add(
            NeedKind.Sleep,
            asleep ? SleepRecoveryPerSecond * secondsThisTick : -SleepDrainPerSecond * burnedSeconds
        )
    })
}

/**
 * Counts down every animal standing still to feed or drink, and pays the one that
 * finishes.
 *
 * Queried on CollectingResource ALONE, with Needs fetched inside. That is not a style
 * choice: ForEachEntityWith iterates whichever of the queried stores is smallest, and
 * IComponentRegistry only promises that deleting the CURRENTLY VISITED entity's
 * component is safe. Querying both components would make that guarantee depend on
 * which store happened to be smaller this frame -- fine until a herd grows and the
 * removal below starts skipping entries.
 *
 * The need is paid on completion rather than in instalments, so an animal shoved off
 * the water halfway through gets nothing. An interrupted drink is not a drink.
 */
function AdvanceCollections(registry : IRegistry, secondsThisTick : number) {
    registry.ForEachEntityWith([CollectingResource], (entity, collecting)=>{
        collecting.remainingSeconds -= secondsThisTick

        if (collecting.remainingSeconds > 0) return

        const needs = registry.GetComponent(entity, Needs)

        // A collector with no appetites is not a contradiction worth throwing over --
        // the component can be attached to anything. It just has nothing to be paid.
        if (needs) needs.Add(collecting.need, CollectionGainByNeed[collecting.need] ?? 0)

        registry.RemoveComponent(entity, CollectingResource)
    })
}

/**
 * Ages every herd's destination, and winds the clock on how long it has been getting
 * nowhere.
 *
 * The migration expiry only counts down while the herd is actually migrating, so a herd
 * that stops to graze does not quietly time out the lake it was heading for.
 *
 * The stall clock, by contrast, runs in every state that has somewhere to be. It is what
 * lets a herd notice it is blocked: a destination is otherwise only ever replaced on
 * arrival, and arrival is exactly the thing that does not happen when there is a mountain
 * in the way. The AI resets this whenever the herd covers real ground, so a journey that
 * is going fine never trips it however long it takes.
 */
function AgeMigrationGoals(registry : IRegistry, secondsThisTick : number) {
    registry.ForEachEntityWith([HerdGoal], (_, goal)=>{
        goal.StallSeconds += secondsThisTick

        if (goal.State !== HerdState.Migrate) return
        if (goal.DestinationSecondsRemaining <= 0) return

        goal.DestinationSecondsRemaining -= secondsThisTick
    })
}

/**
 * What the herd owning `entity` is doing, or undefined if it belongs to no herd.
 *
 * Sleep is a herd-level decision that individuals act out, so whether an animal is
 * recovering depends on its owner rather than on anything it holds itself.
 */
function OwningHerdState(registry : IRegistry, entity : Entity) : number | undefined {
    const ownedBy = registry.GetComponent(entity, OwnedBy)

    if (!ownedBy) return undefined

    return registry.GetComponent(ownedBy.owner, HerdGoal)?.State
}
