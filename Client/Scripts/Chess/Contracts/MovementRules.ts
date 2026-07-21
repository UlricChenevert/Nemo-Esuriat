import type { IGenerateValidMoves } from "../Interfaces/IGenerateValidMoves";

export class MovementRules {
    constructor (public generateValidMoves : IGenerateValidMoves) {}
}