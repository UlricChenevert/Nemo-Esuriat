/**
 * What a body is worth to eat, in the same units as Needs.hungerUnits.
 *
 * Carried by things that are ALIVE as well as by corpses, and copied across when
 * one becomes the other. That is the point of it being its own component: how
 * nourishing an animal is, is a fact about the animal, decided once where the
 * animal is created. The alternative -- deciding it at the moment of death --
 * would put the number in whichever system happened to do the killing, and a deer
 * would be worth a different meal depending on what killed it.
 *
 * Same scale as Needs deliberately, so eating is a transfer rather than a
 * conversion: what leaves the corpse is exactly what arrives in the eater.
 */
export class Consumable {
    constructor (public hungerUnits : number) {}
}
