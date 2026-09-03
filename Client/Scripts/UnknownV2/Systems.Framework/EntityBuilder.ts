import { AnimalLayer, BackgroundLayer, GameColors, MenuArtLayer, MenuBackdropLayer, MenuLayer, MenuPanelPalette, MenuPanelStripeWidth, TextColor, TextLayer } from "../Configuration/DisplayConstants.ts";
import { GameWidth } from "../Configuration/GameConstants.ts";
import type { Color } from "../Contracts/Components/Color.ts";
import { ScreenPosition } from "../Contracts/Components/ScreenPosition.ts";
import { ActionListener } from "../Contracts/Components/ActionListener.ts";
import type { GameAction } from "../Contracts/Actions/GameActions.ts";
import { ChunkWidth } from "../Configuration/WorldConstants.ts";
import { ChunkCoordinate } from "../Contracts/Components/ChunkCoordinate.ts";
import type { Entity } from "../Contracts/Components/Entity.ts";
import { IsSelectable } from "../Contracts/Components/IsSelectible.ts";
import { MultiTileRepresentation } from "../Contracts/Components/MultiTileRepresentation.ts";
import { Layer } from "../Contracts/Components/Layer.ts";
import { OwnedBy } from "../Contracts/Components/OwnedBy.ts";
import { Owns } from "../Contracts/Components/Owns.ts";
import { Position } from "../Contracts/Components/Position.ts";
import { Representation } from "../Contracts/Components/Representation.ts";
import { IsCollidable } from "../Contracts/Tags/IsCollideable.ts";
import { IsMoveable } from "../Contracts/Tags/IsMovable.ts";
import { IsPlayer } from "../Contracts/Tags/IsPlayer.ts";
import { IsCamera } from "../Contracts/Tags/IsCamera.ts";
import { Human } from "../Contracts/Tags/Human.ts";
import type { IRegistry } from "../Interfaces/IRegistry.ts";
import { MovementFlag } from "../Contracts/Tags/MovementFlag.ts";
import { HerdOwner } from "../Contracts/Components/HerdOwner.ts";
import { HerdGoal } from "../Contracts/Components/HerdGoal.ts";
import { Needs } from "../Contracts/Components/Needs.ts";
import { Carcass } from "../Contracts/Components/Carcass.ts";
import { Consumable } from "../Contracts/Components/Consumable.ts";
import { IsPredator } from "../Contracts/Components/IsPredator.ts";
import { ClickListener } from "../Contracts/Components/ClickListener.ts";
import { ClickGesture, type ClickGestureValue } from "../Contracts/Actions/GameActions.ts";
import { LinearCongruentialGenerator } from "../Libraries/Random/LinearCongruentialGenerator.ts";
import { AnimalSpeed, DefaultHungerUnits } from "../Configuration/GameConstants.ts";
import type { IRandomNumberGenerator } from "../Interfaces/IRandomNumberGenerator.ts";

/**
 * The fallback source of herd layouts, for callers with no generator of their
 * own to pass. Shared rather than per-herd so successive herds keep drawing from
 * one sequence instead of restarting it.
 */
const herdLayoutGenerator = new LinearCongruentialGenerator(Date.now())


export class EntityBuilder {
    entity : Entity
    
    constructor (private registry : IRegistry, entity? : Entity) {
        this.entity = (entity)? entity : this.registry.CreateEntity()
        
        return this
    }

    AddPosition(position : Position) {
        this.registry.RegisterEntity(this.entity, Position, position)
        return this
    }

    AddRepresentation(representation : Representation) {
        this.registry.RegisterEntity(this.entity, Representation, new Representation(representation.model, representation.color.Copy(), representation.fillsCell))
        return this
    }

    AddLayer(layer : Layer) {
        this.registry.RegisterEntity(this.entity, Layer, layer)
        return this
    }

    /**
     * Unlike AddRepresentation, this stores the component as given. The palette
     * is shared by design, and the tile indices are large enough that copying
     * them per entity would defeat the point of the compact representation.
     */
    AddMultiTileRepresentation(multiTileRepresentation : MultiTileRepresentation) {
        this.registry.RegisterEntity(this.entity, MultiTileRepresentation, multiTileRepresentation)
        return this
    }

    AddChunkCoordinate(chunkCoordinate : ChunkCoordinate) {
        this.registry.RegisterEntity(this.entity, ChunkCoordinate, chunkCoordinate)
        return this
    }

    /**
     * Makes this entity the camera. Its Position becomes the centre of the
     * viewport, so it needs one -- a camera with no Position is invisible to
     * FindCameraEntity and the view stays wherever it was.
     */
    AddCamera() {
        this.registry.RegisterEntity(this.entity, IsCamera, new IsCamera())
        return this
    }

    AddMovement(speed : number) {
        this.registry.RegisterEntity(this.entity, IsMoveable, new IsMoveable(speed))

        return this
    }

    AddTags(isSelectable : boolean, isCollidable : boolean, isPlayer : boolean, movementFlag? : boolean) {
        if (isSelectable) this.registry.RegisterEntity(this.entity, IsSelectable, new IsSelectable)
        if (isCollidable) this.registry.RegisterEntity(this.entity, IsCollidable, new IsCollidable())
        if (isPlayer) this.registry.RegisterEntity(this.entity, IsPlayer, new IsPlayer())
        if (movementFlag) this.registry.RegisterEntity(this.entity, MovementFlag, new MovementFlag())

        return this
    }

    /**
     * Its own method rather than a fifth flag on AddTags: the boolean list there
     * is already hard to read at the call site, and unlike those, this one says
     * what the entity *is* rather than which systems may touch it.
     */
    AddHuman() {
        this.registry.RegisterEntity(this.entity, Human, new Human())

        // A person is something herds flee, so they are given the predator marker
        // here rather than herds carrying a second scan for people specifically.
        // Human stays a pure identity tag and says nothing about danger; IsPredator
        // says how much, at the default severity -- enough that a lone walker
        // scatters a herd without bunching it.
        return this.AddPredator()
    }

    /**
     * Marks this entity as something herds are afraid of, at `severity`.
     *
     * Severity sums across every threat near a herd, and the total is what decides
     * whether it bunches or scatters -- so this is as much a statement about how
     * much worse a pack is than one animal as it is about this entity.
     */
    AddPredator(severity? : number) {
        this.registry.RegisterEntity(
            this.entity, IsPredator, (severity === undefined) ? new IsPredator() : new IsPredator(severity)
        )

        return this
    }

    /**
     * Gives this entity appetites: food, water and sleep, all starting full.
     *
     * Its own method rather than folded into MakeHerd because a member's needs are
     * what it CONTRIBUTES to its herd's decisions, and anything else that should
     * get hungry -- a person, a lone animal -- wants the same component without
     * wanting to be a herd.
     */
    AddNeeds(needs : Needs = new Needs()) {
        this.registry.RegisterEntity(this.entity, Needs, needs)

        return this
    }

    /**
     * Declares which clicks this entity hears, on a given input layer.
     *
     * The click counterpart of AddActionListener, and claiming works the same way:
     * claiming a gesture stops it reaching layers below, so this is both "tell me about
     * these" and "nobody underneath gets these".
     */
    AddClickListener(layer : Entity, gesture : ClickGestureValue = ClickGesture.Plain) {
        this.registry.RegisterEntity(this.entity, ClickListener, new ClickListener(layer, gesture))

        return this
    }

    /**
     * Makes this entity worth eating, at `hungerUnits`.
     *
     * Given to living animals and people, not only to corpses: how nourishing a
     * body is, is a fact about the body, and KillEntity copies it onto whatever is
     * left. Deciding it at the moment of death instead would mean the number lived
     * in whichever system did the killing.
     */
    AddConsumable(hungerUnits : number = DefaultHungerUnits) {
        this.registry.RegisterEntity(this.entity, Consumable, new Consumable(hungerUnits))

        return this
    }

    /**
     * Marks this entity as a dead body that may be eaten.
     *
     * Separate from AddConsumable, which the living also carry, because only this
     * one licenses eating -- see Carcass.
     */
    AddCarcass() {
        this.registry.RegisterEntity(this.entity, Carcass, new Carcass())

        return this
    }

    AddOwner(owner : Entity) {

        this.registry.RegisterEntity(this.entity, OwnedBy, new OwnedBy(owner))

        // Append to the owner's existing Owns rather than replacing it, otherwise
        // each new child would evict its predecessor and orphan it.
        const existingOwns = this.registry.GetComponent(owner, Owns)

        if (existingOwns) {
            existingOwns.Add(this.entity)
        } else {
            this.registry.RegisterEntity(owner, Owns, new Owns(this.entity))
        }

        return this
    }

    /**
     * Declares which actions this entity hears, on a given input layer.
     *
     * Claiming an action stops it reaching layers below, so this is both "tell
     * me about these" and "nobody underneath gets these" -- the two are the same
     * statement, and separating them would let an entity silently shadow input
     * it never reads.
     */
    AddActionListener(layer : Entity, ...actions : GameAction[]) {
        this.registry.RegisterEntity(this.entity, ActionListener, new ActionListener(layer, ...actions))

        return this
    }

    GetEntity () {
        return this.entity
    }

    /**
     * Turns this entity into one chunk of terrain: a slab of ground drawn from a
     * single tile buffer, anchored at the chunk's top-left world tile.
     *
     * The one place a multi-tile entity is assembled. StreamChunks used to build
     * this inline, which left the shape of a chunk entity -- which components,
     * which layer, how the chunk coordinate becomes a world position -- known
     * only to the system that decides *when* chunks exist. Two unrelated
     * concerns in one function, and no example for the next multi-tile thing
     * (a building, a UI panel) to follow.
     *
     * BackgroundLayer because terrain is what everything else stands on: the
     * renderer resolves multi-tile entities first precisely so the things above
     * them take the cheap overwrite branch.
     */
    MakeTerrainChunk (chunkX : number, chunkY : number, terrain : MultiTileRepresentation) {
        return this
            .AddPosition(new Position(chunkX * ChunkWidth, chunkY * ChunkWidth))
            .AddLayer(new Layer(BackgroundLayer))
            .AddMultiTileRepresentation(terrain)
            .AddChunkCoordinate(new ChunkCoordinate(chunkX, chunkY))
    }

    AddText(text : string, position : Position) {
        
        let newLines = 0
        let startingPosition = 0

        for (let i = 0; i < text.length; i++) {
            if (text[i]! == '\n') {newLines++; startingPosition -= i + 1; continue}

            const x = position.x + i + startingPosition
            const y = position.y + newLines

            new EntityBuilder(this.registry)
                .AddOwner(this.entity)
                .AddRepresentation(new Representation(text[i]!, TextColor))
                .AddPosition(new Position(x, y))
                .AddLayer(new Layer(TextLayer))
        }

        return this
    }

    /**
     * The screen-anchored twin of AddText: same one-entity-per-glyph layout, but
     * pinned to the display instead of the world.
     *
     * Kept separate rather than folded into AddText behind a flag because the
     * two differ in the component they write, and a renderer query is a straight
     * component match -- a flag would have to become a branch inside the draw
     * loop for every entity in the game.
     *
     * Glyphs are owned by this entity, so one DestroyEntity removes the whole
     * string. That is what lets a menu redraw itself by destroying its body and
     * building a new one rather than diffing characters.
     */
    AddScreenText(text : string, screenPosition : ScreenPosition, color : Color = TextColor, layerIndex : number = MenuLayer) {
        let newLines = 0
        let startingPosition = 0

        for (let i = 0; i < text.length; i++) {
            if (text[i]! == '\n') {newLines++; startingPosition -= i + 1; continue}

            const x = screenPosition.x + i + startingPosition
            const y = screenPosition.y + newLines

            const glyph = new EntityBuilder(this.registry)
                .AddOwner(this.entity)
                .AddRepresentation(new Representation(text[i]!, color))
                .AddLayer(new Layer(layerIndex))
                .GetEntity()

            this.registry.RegisterEntity(glyph, ScreenPosition, new ScreenPosition(x, y))
        }

        return this
    }

    /**
     * A picture behind a menu, centred on the viewport.
     *
     * Art wider or taller than the viewport is not cropped here: it is anchored
     * at a negative screen coordinate and the renderer's existing multi-tile
     * clipping takes the middle of it. That means one piece of art suits any
     * GameWidth, and shrinking the viewport crops the picture rather than
     * requiring a differently sized one.
     */
    AddScreenArt(art : MultiTileRepresentation, layerIndex : number = MenuArtLayer) {
        const artEntity = new EntityBuilder(this.registry)
            .AddOwner(this.entity)
            .AddMultiTileRepresentation(art)
            .AddLayer(new Layer(layerIndex))
            .GetEntity()

        this.registry.RegisterEntity(artEntity, ScreenPosition, new ScreenPosition(
            Math.floor((GameWidth - art.width) / 2),
            Math.floor((GameWidth - art.height) / 2)
        ))

        return this
    }

    /**
     * The striped panel a menu's text sits on.
     *
     * One entity rather than one per cell. A panel is several hundred tiles and
     * is rebuilt every time the cursor moves a row, so the per-cell form was
     * hundreds of entities created and destroyed per keypress;
     * MultiTileRepresentation is documented for exactly this -- one byte per tile
     * into a two-entry palette.
     *
     * On MenuBackdropLayer, below the text. Both draw: the renderer keeps a
     * background and a glyph per cell, which is what stops the text punching
     * holes through the panel it is written on.
     */
    AddScreenPanel(screenX : number, screenY : number, width : number, height : number) {
        const indices = new Uint8Array(width * height)

        for (let offsetY = 0; offsetY < height; offsetY++) {
            const rowOffset = offsetY * width

            for (let offsetX = 0; offsetX < width; offsetX++) {
                // Striped on the ABSOLUTE screen column, not the panel-local one,
                // so the bands sit in the same places whatever the panel's width
                // is. Keyed on the local column instead, every menu of a
                // different size would shift the whole pattern sideways.
                indices[rowOffset + offsetX] = Math.floor((screenX + offsetX) / MenuPanelStripeWidth) % 2
            }
        }

        const panel = new EntityBuilder(this.registry)
            .AddOwner(this.entity)
            .AddMultiTileRepresentation(new MultiTileRepresentation(width, height, indices, MenuPanelPalette))
            .AddLayer(new Layer(MenuBackdropLayer))
            .GetEntity()

        this.registry.RegisterEntity(panel, ScreenPosition, new ScreenPosition(screenX, screenY))

        return this
    }

    /**
     * Turns this entity into the owner of a herd of `amount` animals scattered
     * around `position`.
     *
     * Takes a generator rather than seeding one per call, which is what the
     * first version did. Crossing a chunk boundary streams five chunks at once,
     * so herds are routinely built within the same millisecond -- identically
     * seeded, they came out as the same herd laid down twice.
     */
    MakeHerd(position : Position, amount : number, representationString : string, random : IRandomNumberGenerator = herdLayoutGenerator) {
        const herd = new HerdOwner()
        this.registry.RegisterEntity(this.entity, HerdOwner, herd)

        // The tuning and the roaming state are two components, and a herd is only
        // steerable with both: HerdOwner says how it behaves, HerdGoal records what
        // it is currently doing. Registered together here so no herd can exist
        // half-built.
        this.registry.RegisterEntity(this.entity, HerdGoal, new HerdGoal())

        for (let i = 0; i < amount; i++) {
            const distance = random.Random() * herd.WanderRadius
            const direction = random.Random() * 2 * Math.PI

            const xDelta = Math.cos(direction) * distance
            const yDelta = Math.sin(direction) * distance

            const newPostion = new Position(position.x + xDelta, position.y + yDelta)

            new EntityBuilder(this.registry)
                .AddPosition(newPostion)
                .AddRepresentation(new Representation(representationString, GameColors.Animal))
                .AddLayer(new Layer(AnimalLayer))
                .AddMovement(AnimalSpeed)
                // Each animal carries its own appetites. The herd's decisions are
                // an average of what its members report, so this is the thing that
                // makes an individual able to influence where the herd goes.
                .AddNeeds()
                // Carried while it is alive, and copied onto its corpse when it is
                // not: an animal is a meal to something whether it knows it or not.
                .AddConsumable()
                .AddOwner(this.entity)
                .GetEntity()
        }

        return this
    }
}