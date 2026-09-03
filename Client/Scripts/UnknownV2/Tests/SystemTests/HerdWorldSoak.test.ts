import { describe, it, expect } from "vitest";
import { AnimalSpeed } from "../../Configuration/GameConstants.ts";
import { TerrainKind, TerrainKindNames } from "../../Configuration/DisplayConstants.ts";
import { HerdGoal } from "../../Contracts/Components/HerdGoal.ts";
import { HerdOwner } from "../../Contracts/Components/HerdOwner.ts";
import { Position } from "../../Contracts/Components/Position.ts";
import { TimeResources, WorldStreamingResources } from "../../Contracts/SystemResources.ts";
import { LinkedList } from "../../Libraries/FastList/FastList.ts";
import { LinearCongruentialGenerator } from "../../Libraries/Random/LinearCongruentialGenerator.ts";
import { EntityBuilder } from "../../Systems.Framework/EntityBuilder.ts";
import { EventQueue } from "../../Systems.Framework/EventQueue.ts";
import { HandleAIMovement } from "../../Systems.Gameloop/HandleAIMovement.ts";
import { HandleMovement } from "../../Systems.Gameloop/HandleMovement.ts";
import { UpdateNeeds } from "../../Systems.Gameloop/UpdateNeeds.ts";
import { BuildTestRegistry } from "../TestHelpers/BuildTestRegistry.ts";
import { CreateWorldStreamingResources } from "../../Utilities/CreateWorldStreamingResources.ts";
import { IsPassableTerrain, TerrainKindAtWorldTile } from "../../Utilities/TerrainUtilities.ts";

/**
 * Herds dropped all over the REAL procedural world and left to run.
 *
 * Every other herd suite builds the ground by hand, which is right for testing one rule at
 * a time and useless for the question this asks: whether a herd put down on the terrain
 * the player actually sees gets on with its life, wherever it happens to land.
 *
 * Both of the bugs this exists to catch were invisible to the hand-built worlds. Herds
 * pinned themselves against real mountains while sailing through a test with a straight
 * wall in it, and animals walked onto rock that the veto had checked and passed -- because
 * checking points along a path is not the same as checking the tiles it crosses, and only
 * fractal terrain has the one-tile features that tell the two apart.
 */
describe("herds on the real world", () => {
    const SecondsPerTick = 1 / 60;
    const TicksPerRun = 600;

    function RunHerdAt(world : WorldStreamingResources, startX : number, startY : number) {
        const registry = BuildTestRegistry();
        const owner = new EntityBuilder(registry).GetEntity();
        const goal = new HerdGoal();

        registry.RegisterEntity(owner, HerdOwner, new HerdOwner());
        registry.RegisterEntity(owner, HerdGoal, goal);

        const members = ([[0, 0], [1, 0], [0, 1], [1, 1], [2, 0]] as [number, number][]).map(([dx, dy]) =>
            new EntityBuilder(registry)
                .AddPosition(new Position(startX + dx, startY + dy))
                .AddMovement(AnimalSpeed)
                .AddNeeds()
                .AddOwner(owner)
                .GetEntity()
        );

        const CentreOf = () => {
            const positions = members.map((member) => registry.GetComponent(member, Position)!);

            return new Position(
                positions.reduce((total, position) => total + position.x, 0) / positions.length,
                positions.reduce((total, position) => total + position.y, 0) / positions.length
            );
        };

        // The guarantee is about WALKING onto bad ground, so what is counted is the
        // transition from good to bad. A member can legitimately begin stranded -- herds
        // scatter over a radius when they spawn and the world streams in beneath them --
        // and recovering from that is behaviour the veto deliberately exempts.
        const wasOnGoodGround = members.map((member) => {
            const position = registry.GetComponent(member, Position)!;

            return IsPassableTerrain(world, position.x, position.y);
        });

        let walkedOntoBadGround = 0;
        // Ground covered, not distance from home. A foraging herd wanders in curves and can
        // legitimately end a run near where it began, so net displacement says nothing about
        // whether it was stuck -- whereas a herd pinned against a mountain covers almost
        // nothing however long it is left.
        let pathLength = 0;

        let previousCentre = CentreOf();

        for (let tick = 0; tick < TicksPerRun; tick++) {
            const time = new TimeResources();
            time.deltaSeconds = SecondsPerTick;

            HandleMovement(registry, new EventQueue(new LinkedList()), time);
            UpdateNeeds(registry, time);
            HandleAIMovement(registry, world, new LinearCongruentialGenerator(99));

            members.forEach((member, index) => {
                const position = registry.GetComponent(member, Position)!;
                const onGoodGround = IsPassableTerrain(world, position.x, position.y);

                if (wasOnGoodGround[index] && !onGoodGround) walkedOntoBadGround++;

                wasOnGoodGround[index] = onGoodGround;

                expect(Number.isFinite(position.x)).toBe(true);
                expect(Number.isFinite(position.y)).toBe(true);
            });

            const centre = CentreOf();

            pathLength += Math.hypot(centre.x - previousCentre.x, centre.y - previousCentre.y);
            previousCentre = centre;
        }

        return {pathLength : pathLength, walkedOntoBadGround : walkedOntoBadGround};
    }

    /**
     * Ground a herd must cover in ten seconds to count as going about its business.
     *
     * A herd at AnimalSpeed could cover thirty tiles in that time if it walked in a
     * straight line, which it never does -- it weaves, and it slows as it jostles. A third
     * of the theoretical maximum is comfortably clear of a healthy herd and nowhere near a
     * pinned one, which manages one or two.
     */
    const MinimumGroundCovered = 10;

    it("gets on with its life wherever it starts, and never walks onto ground it cannot cross", () => {
        const world = CreateWorldStreamingResources();

        const starts : [number, number][] = [];

        // Scattered widely and coprimely, so the sample crosses every band the noise field
        // produces rather than marching along one contour of it.
        for (let index = 0; index < 90; index++) starts.push([index * 37 - 1200, index * 53 - 900]);

        const stuck : string[] = [];
        let startedOnLand = 0;

        starts.forEach(([x, y]) => {
            if (!IsPassableTerrain(world, x, y)) return;

            startedOnLand++;

            const result = RunHerdAt(world, x, y);

            expect(result.walkedOntoBadGround).toBe(0);

            if (result.pathLength < MinimumGroundCovered) {
                stuck.push(`(${x},${y}) on ${TerrainKindNames[TerrainKindAtWorldTile(world, x, y)]} covered ${result.pathLength.toFixed(2)}`);
            }
        });

        expect(startedOnLand).toBeGreaterThan(40);
        expect(stuck).toEqual([]);
    });

    it("works its way out from beside a real mountain", () => {
        // The reported bug, reproduced on the actual noise field rather than against a
        // hand-drawn wall: a herd standing with a mountain a few tiles away used to stop
        // dead and stay there.
        const world = CreateWorldStreamingResources();

        let found : [number, number] | undefined = undefined;

        for (let x = -400; x < 400 && found === undefined; x += 3) {
            for (let y = -400; y < 400; y += 3) {
                if (!IsPassableTerrain(world, x, y)) continue;
                if (TerrainKindAtWorldTile(world, x + 4, y) !== TerrainKind.Mountain) continue;
                if (TerrainKindAtWorldTile(world, x + 6, y) !== TerrainKind.Mountain) continue;

                found = [x, y];
                break;
            }
        }

        expect(found).toBeDefined();

        const result = RunHerdAt(world, found![0], found![1]);

        expect(result.walkedOntoBadGround).toBe(0);
        expect(result.pathLength).toBeGreaterThan(MinimumGroundCovered);
    });
});
