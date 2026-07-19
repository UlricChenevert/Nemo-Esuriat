export class Entity {}

export class BasicEntity extends Entity {
    constructor (public id : number) {super()}
}

export class IndexableEntity extends Entity {
    constructor (public index : number, public version : number) {super()}
}