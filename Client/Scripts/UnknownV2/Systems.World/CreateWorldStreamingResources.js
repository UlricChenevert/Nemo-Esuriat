import { GradientGridWidth, NoiseGain, NoiseLacunarity, NoiseOctaves, NoisePersistence, NoiseScale, WorldSeed } from "../Configuration/WorldConstants.js";
import { WorldStreamingResources } from "../Contracts/SystemResources.js";
import { PerlinNoise } from "../Libraries/Noise/PerlinNoise.js";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.js";
import { CreateDefaultKeyValueStore } from "../Libraries/Storage/CreateDefaultKeyValueStore.js";
/**
 * Builds the world's noise field and everything chunk streaming needs.
 *
 * Lives here rather than in Game.ts so that constructing a world does not drag
 * in Game.ts's DOM bootstrap, which lets tests exercise the real composition
 * instead of reassembling an approximation of it.
 *
 * The seed alone determines the terrain, so the same seed always yields the same
 * world and none of it has to be stored. The key-value store is here for the
 * content that will not be reproducible from a seed — villages, animals —
 * rather than for terrain.
 */
export function CreateWorldStreamingResources() {
    const randomNumberGenerator = new LinearCongruentialGenerator(WorldSeed);
    const noiseGenerator = new PerlinNoise(randomNumberGenerator, {
        GradientGridWidth: GradientGridWidth,
        NoiseScale: NoiseScale,
        Octaves: NoiseOctaves,
        Persistence: NoisePersistence,
        Lacunarity: NoiseLacunarity,
        Gain: NoiseGain
    });
    return new WorldStreamingResources(noiseGenerator, CreateDefaultKeyValueStore(), WorldSeed);
}
//# sourceMappingURL=CreateWorldStreamingResources.js.map