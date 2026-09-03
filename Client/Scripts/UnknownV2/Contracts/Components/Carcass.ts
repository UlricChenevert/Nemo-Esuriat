/**
 * Marks an entity as a dead body that may be eaten.
 *
 * Kept separate from Consumable, which every live animal also carries, because
 * "how much meat is on it" and "is it dead" are different questions and only the
 * second one licenses eating. Querying [Carcass, Consumable] is what stops an
 * Interact press eating a live deer standing on the player's tile.
 */
export class Carcass {}
