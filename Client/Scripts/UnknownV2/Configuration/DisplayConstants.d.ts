import { Color } from "../Contracts/Components/Color.ts";
export declare const BoardColorMain: Color;
export declare const BoardColorAlternate: Color;
export declare const BackgroundColor: Color;
export declare const PrimaryPieceColor: Color;
export declare const ColorTranslation = 25;
export declare const SecondaryPieceColor: Color;
export declare const TextColor: Color;
export declare const UndefinedLayer = -1;
export declare const BackgroundLayer = 0;
/** Move hints sit over the board but under the pieces, so a piece is never hidden. */
export declare const MoveHintLayer = 1;
export declare const AnimalLayer = 2;
export declare const PlayerLayer = 3;
export declare const TextLayer = 5;
/** Above everything: the picker has to be clickable over whatever it covers. */
export declare const PromotionPickerLayer = 6;
/** The glyph a legal destination is marked with, in the moving side's colour. */
export declare const MoveHintGlyph = ".";
export declare const TileSizePixels = 16;
export declare const CharacterRepresentation: {
    Blank: string;
    Character: string;
    NPC: string;
    Water: string;
    Null: string;
    Animal: string;
    Path: string;
    PineTree: string;
    Hill: string;
    Mountain: string;
    Grass: string;
    Shrine: string;
    Farmland: string;
    SmallHouse: string;
    Hut: string;
    LargeHouse: string;
    LoadingBar: string;
};
export declare const GameColors: {
    Background: Color;
    Player: Color;
    Villages: Color;
    NPC: Color;
};
//# sourceMappingURL=DisplayConstants.d.ts.map