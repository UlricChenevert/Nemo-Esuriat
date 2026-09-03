import { GradientGridWidth, NoiseGain, NoiseLacunarity, NoiseOctaves, NoisePersistence, NoiseScale, WorldSeed } from "../Configuration/WorldConstants.ts";
import { WorldStreamingResources } from "../Contracts/SystemResources.ts";
import { PerlinNoise } from "../Libraries/Noise/PerlinNoise.ts";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.ts";
import { CreateDefaultKeyValueStore } from "../Libraries/Storage/CreateDefaultKeyValueStore.ts";

/**
 * Builds the world's noise field and everything chunk streaming needs.
 *
 * Lives here rather than in Game.ts so that constructing a world does not drag
 * in Game.ts's DOM bootstrap, which lets tests exercise the real composition
 * instead of reassembling an approximation of it. A factory rather than a
 * system: it runs once, at composition, and never touches the registry.
 *
 * The seed alone determines the terrain, so the same seed always yields the same
 * world and none of it has to be stored. That is also what lets
 * TerrainKindAtWorldTile answer for ground that was never streamed. The
 * key-value store is here for the content that will not be reproducible from a
 * seed — villages, animals — rather than for terrain.
 */
export function CreateWorldStreamingResources () : WorldStreamingResources {
    const randomNumberGenerator = new LinearCongruentialGenerator(WorldSeed)

    const noiseGenerator = new PerlinNoise(randomNumberGenerator, {
        GradientGridWidth: GradientGridWidth,
        NoiseScale: NoiseScale,
        Octaves: NoiseOctaves,
        Persistence: NoisePersistence,
        Lacunarity: NoiseLacunarity,
        Gain: NoiseGain
    })

    return new WorldStreamingResources(noiseGenerator, CreateDefaultKeyValueStore(), WorldSeed)
}
